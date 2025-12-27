// 🖨️ 프린터 서버 v2.4 - iOS/Android 인증서 지원 + 프린터 큐
// 바코드프린터/printer-server.js

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const { exec } = require('child_process');

const sharp = require('sharp');

// 🆕 로컬 IP 주소 가져오기 함수
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // IPv4, 내부 IP 아님, 루프백 아님
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1'; // 못 찾으면 기본값
}
const { PNG } = require('pngjs');
const QRCode = require('qrcode');
const iconv = require('iconv-lite');

process.stdout.setEncoding('utf8');
process.stderr.setEncoding('utf8');

console.log('🖨️ 프린터 서버 v2.4 시작 (iOS/Android 인증서 지원 + 프린터 큐)');

const CONFIG = {
  httpPort: 8080,
  httpsPort: 8443,
  timeout: 5000,
  printers: {
    barcode: {
      name: 'TSC_TTP-244_Pro',
      pc: 'LAPTOP-IN37RDJM',
      type: 'barcode'
    },
    receipt: {
      name: 'POS80',
      pc: 'LAPTOP-IN37RDJM',
      type: 'receipt'
    }
  }
};

// 🔄 프린터 큐 관리 클래스
class PrintQueue {
  constructor(name) {
    this.name = name;
    this.queue = [];
    this.isProcessing = false;
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      pending: 0
    };
  }

  async add(jobData) {
    const job = {
      id: `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data: jobData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      error: null
    };

    this.queue.push(job);
    this.stats.pending = this.queue.length;
    this.stats.total++;

    console.log(`📋 [${this.name}] 작업 추가: ${job.id} (큐: ${this.queue.length}개)`);

    if (!this.isProcessing) {
      this.processNext();
    }

    return job.id;
  }

  async processNext() {
    if (this.isProcessing) {
      console.log(`⏳ [${this.name}] 이미 처리 중...`);
      return;
    }

    const job = this.queue[0];
    if (!job) {
      console.log(`✅ [${this.name}] 큐 비어있음`);
      return;
    }

    this.isProcessing = true;
    job.status = 'processing';
    job.startedAt = new Date().toISOString();

    console.log(`▶️ [${this.name}] 작업 시작: ${job.id}`);

    try {
      const result = await job.data.executor();
      
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.result = result;

      if (result.success) {
        this.stats.success++;
        console.log(`✅ [${this.name}] 작업 완료: ${job.id}`);
      } else {
        this.stats.failed++;
        job.error = result.message;
        console.log(`⚠️ [${this.name}] 작업 실패: ${job.id} - ${result.message}`);
      }

    } catch (error) {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
      job.error = error.message;
      this.stats.failed++;
      console.error(`❌ [${this.name}] 작업 오류: ${job.id}`, error);
    }

    this.queue.shift();
    this.stats.pending = this.queue.length;
    this.isProcessing = false;

    if (this.queue.length > 0) {
      console.log(`🔄 [${this.name}] 다음 작업 처리 (남은 작업: ${this.queue.length}개)`);
      setTimeout(() => this.processNext(), 100);
    } else {
      console.log(`🎉 [${this.name}] 모든 작업 완료!`);
    }
  }

  getStatus() {
    return {
      name: this.name,
      queue: this.queue.map(j => ({
        id: j.id,
        status: j.status,
        createdAt: j.createdAt,
        startedAt: j.startedAt
      })),
      stats: this.stats,
      isProcessing: this.isProcessing
    };
  }

  clear() {
    const cleared = this.queue.length;
    this.queue = [];
    this.stats.pending = 0;
    console.log(`🗑️ [${this.name}] 큐 초기화: ${cleared}개 작업 삭제`);
    return cleared;
  }
}

// 프린터별 큐 생성
const printerQueues = {
  barcode: new PrintQueue('바코드프린터'),
  receipt: new PrintQueue('영수증프린터')
};

function loadSSLCert() {
  console.log('🔐 인증서 로드 중...');
  const certFile = 'localhost+2.pem';
  const keyFile = 'localhost+2-key.pem';
  
  if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
    console.error('❌ 인증서 파일 없음');
    return null;
  }
  
  try {
    const cert = fs.readFileSync(certFile, 'utf8');
    const key = fs.readFileSync(keyFile, 'utf8');
    console.log('✅ 인증서 로드 성공');
    return { key, cert };
  } catch (e) {
    console.error('❌ 인증서 읽기 실패:', e.message);
    return null;
  }
}

async function printToWindowsShare(commands, printerConfig) {
  return new Promise((resolve) => {
    const printerName = printerConfig.name;
    const printerPC = printerConfig.pc;
    
    console.log(`🖨️ 프린터 출력: \\\\${printerPC}\\${printerName}`);
    
    const tempFile = `print_${Date.now()}.prn`;
    
    try {
      fs.writeFileSync(tempFile, commands, 'binary');
      console.log(`📄 임시 파일: ${tempFile} (${commands.length} bytes)`);
    } catch (writeError) {
      console.error('❌ 파일 생성 실패:', writeError.message);
      resolve({ success: false, message: writeError.message });
      return;
    }
    
    const cmd = `copy /b "${tempFile}" "\\\\${printerPC}\\${printerName}"`;
    
    exec(cmd, { timeout: CONFIG.timeout }, (error, stdout, stderr) => {
      try { 
        fs.unlinkSync(tempFile); 
      } catch (e) { 
        console.warn('⚠️ 임시 파일 삭제 실패:', e.message); 
      }
      
      if (error) {
        console.error('❌ 출력 실패:', error.message);
        resolve({ success: false, message: error.message });
      } else {
        console.log('✅ 출력 성공');
        resolve({ success: true, message: '출력 완료' });
      }
    });
  });
}

// 🔄 기존 복잡한 QR 코드 생성 함수 (그대로 유지)
async function generateQRCodeESCPOS(qrData, options = {}) {
  try {
    console.log(`QR코드 생성: ${qrData}`);
    
    const size = options.size || 256;
    
    const qrBuffer = await QRCode.toBuffer(qrData, {
      width: size,
      margin: 2,
      errorCorrectionLevel: options.errorCorrectionLevel || 'H',
      type: 'png',
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    const processed = await sharp(qrBuffer)
      .resize(size, size, { 
        fit: 'contain',
        kernel: 'nearest'
      })
      .grayscale()
      .normalise()
      .threshold(128)
      .toFormat('png')
      .toBuffer();
    
    const png = PNG.sync.read(processed);
    const width = png.width;
    const height = png.height;
    
    console.log(`QR코드 완료: ${width}x${height}px`);
    
    const result = [];
    result.push(0x1D, 0x76, 0x30, 0x00);
    result.push((width / 8) & 0xFF, ((width / 8) >> 8) & 0xFF);
    result.push(height & 0xFF, (height >> 8) & 0xFF);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x += 8) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          if (x + bit < width) {
            const idx = (y * width + x + bit) * 4;
            if (png.data[idx] < 128) {
              byte |= (1 << (7 - bit));
            }
          }
        }
        result.push(byte);
      }
    }
    
    return Buffer.from(result);
  } catch (error) {
    console.error('QR코드 생성 실패:', error.message);
    return Buffer.alloc(0);
  }
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 영수증 레이아웃 처리 함수 (내용이 너무 길어서 중요 부분만 표시)
async function generateReceiptFromLayout(receiptData) {
  console.log(`영수증 이미지 생성 (${receiptData.layout?.length || 0}개 요소)`);
  
  const width = 576;
  let currentY = 20;
  const compositeItems = [];
  
  if (receiptData.layout && Array.isArray(receiptData.layout)) {
    for (const item of receiptData.layout) {
      console.log(`  처리 중: ${item.type}`);
      
      try {
        switch (item.type) {
          case 'logo':
            if (item.path) {
              let logoBuffer;
              
              if (item.path.startsWith('data:image')) {
                const base64Data = item.path.split(',')[1];
                logoBuffer = Buffer.from(base64Data, 'base64');
              } else if (item.path.startsWith('http')) {
                const response = await fetch(item.path);
                const arrayBuffer = await response.arrayBuffer();
                logoBuffer = Buffer.from(arrayBuffer);
              } else {
                logoBuffer = fs.readFileSync(item.path);
              }
              
              const resizedLogo = await sharp(logoBuffer)
                .resize(item.width || 300, null, { 
                  fit: 'inside',
                })
                .toBuffer();
                
              const logoMeta = await sharp(resizedLogo).metadata();
              console.log(`리사이즈된 로고 크기: ${logoMeta.width}x${logoMeta.height}`);
              
              let finalLogo = resizedLogo;
              
              if (item.qrData && (item.qrX !== undefined || item.qrY !== undefined)) {
                try {
                  const qrSize = item.qrSize || 100;
                  const qrX = parseInt(item.qrX) || 0;
                  const qrY = parseInt(item.qrY) || 0;
                  const qrText = item.qrText || '';
                  const qrTextSize = item.qrTextSize || 14;
                  
                  console.log(`QR 합성: 위치(${qrX}, ${qrY}), 크기(${qrSize})`);
                  
                  const qrBuffer = await QRCode.toBuffer(item.qrData, {
                    errorCorrectionLevel: 'M',
                    type: 'png',
                    width: qrSize,
                    margin: 2
                  });

                  const enhancedQR = await sharp(qrBuffer)
                    .sharpen()
                    .toBuffer();

                  const compositeItems = [
                    {
                      input: enhancedQR,
                      top: qrY,
                      left: qrX
                    }
                  ];
                  
                  if (qrText) {
                    const textY = qrY + qrSize + 5;
                    const textWidth = qrSize * 2;
                    const textX = qrX - (qrSize / 2);
                    
                    const textSvg = `
                      <svg width="${textWidth}" height="${qrTextSize + 10}">
                        <text x="${textWidth / 2}" y="${qrTextSize + 2}" 
                              font-family="Malgun Gothic, 맑은 고딕, sans-serif" 
                              font-size="${qrTextSize}" 
                              text-anchor="middle"
                              fill="#000000">${qrText}</text>
                      </svg>
                    `;
                    
                    compositeItems.push({
                      input: Buffer.from(textSvg),
                      top: textY,
                      left: textX
                    });
                    
                    console.log(`QR 텍스트 추가: "${qrText}" (폭: ${textWidth}px)`);
                  }
                  
                  finalLogo = await sharp(resizedLogo)
                    .composite(compositeItems)
                    .toBuffer();
                  
                  console.log('QR 코드 합성 완료');
                } catch (qrError) {
                  console.error('QR 코드 합성 실패:', qrError);
                }
              }
              
              const finalMeta = await sharp(finalLogo).metadata();
              const logoX = item.align === 'center' ? (width - finalMeta.width) / 2 : 20;
              
              compositeItems.push({
                input: finalLogo,
                top: currentY,
                left: Math.floor(logoX)
              });
              
              currentY += finalMeta.height + (item.marginBottom || 10);
            }
            break;
          
          case 'qrcode':
            if (item.data) {
              const qrSize = item.size || 128;
              const qrBuffer = await QRCode.toBuffer(item.data, {
                errorCorrectionLevel: item.errorCorrectionLevel || 'H',
                type: 'png',
                width: qrSize,
                margin: 1
              });
              
              const qrX = item.align === 'center' ? (width - qrSize) / 2 : 20;
              compositeItems.push({
                input: qrBuffer,
                top: currentY,
                left: Math.floor(qrX)
              });
              
              currentY += qrSize + (item.marginBottom || 10);
            }
            break;
          
          case 'text': 
            if (item.content) {
              const fontSize = item.fontSize || 12;
              const fontWeight = item.bold ? 'bold' : 'normal';
              const textHeight = fontSize + 10;
              
              const safeContent = escapeXml(item.content);

              let textAnchor = 'start';
              let textX = 20;
              if (item.align === 'center') {
                textAnchor = 'middle';
                textX = width / 2;
              } else if (item.align === 'right') {
                textAnchor = 'end';
                textX = width - 20;
              }

              const textSvg = `
                <svg width="${width}" height="${textHeight}">
                  <text x="${textX}" y="${fontSize + 2}" 
                        font-family="Malgun Gothic, 맑은 고딕, sans-serif" 
                        font-size="${fontSize}" 
                        font-weight="${fontWeight}"
                        text-anchor="${textAnchor}"
                        fill="#000000">${safeContent}</text>
                </svg>
              `;
              
              compositeItems.push({
                input: Buffer.from(textSvg),
                top: currentY,
                left: 0
              });
              
              currentY += textHeight + (item.marginBottom || 5);
            }
            break;
          
          case 'product-line':
            if (item.name) {
              const fontSize = item.fontSize || 12;
              const lineHeight = fontSize + 8;

              let maxCharsPerLine;
              if (fontSize <= 12) {
                maxCharsPerLine = 18;
              } else if (fontSize <= 15) {
                maxCharsPerLine = 16;
              } else {
                maxCharsPerLine = 14;
              }
              
              let line1 = item.name.substring(0, maxCharsPerLine);
              let line2 = item.name.length > maxCharsPerLine ? 
                          item.name.substring(maxCharsPerLine, maxCharsPerLine * 2) : '';

              line1 = escapeXml(line1);
              line2 = escapeXml(line2);
              
              const nameSvg = `
                <svg width="280" height="${lineHeight * 2}">
                  <text x="20" y="${fontSize + 2}" 
                        font-family="Malgun Gothic, 맑은 고딕, sans-serif" 
                        font-size="${fontSize}" 
                        fill="#000000">
                    ${line1}
                    ${line2 ? `<tspan x="20" dy="${lineHeight}">${line2}</tspan>` : ''}
                  </text>
                </svg>
              `;
              compositeItems.push({
                input: Buffer.from(nameSvg),
                top: currentY,
                left: 0
              });
              
              const price = (item.price || 0).toLocaleString();
              const qty = String(item.quantity || 0);
              const total = (item.total || 0).toLocaleString();
              
              const priceSvg = `
                <svg width="280" height="${lineHeight}">
                  ${item.price > 0 ? `
                  <text x="80" y="${fontSize + 2}" 
                        font-family="Malgun Gothic, 맑은 고딕, sans-serif" 
                        font-size="${fontSize}" 
                        text-anchor="end"
                        fill="#000000">${price}</text>
                  ` : ''}
                  <text x="150" y="${fontSize + 2}" 
                        font-family="Malgun Gothic, 맑은 고딕, sans-serif" 
                        font-size="${fontSize}" 
                        text-anchor="middle"
                        fill="#000000">${qty}</text>
                  <text x="280" y="${fontSize + 2}" 
                        font-family="Malgun Gothic, 맑은 고딕, sans-serif" 
                        font-size="${fontSize}" 
                        text-anchor="end"
                        fill="#000000">${total}</text>
                </svg>
              `;
              compositeItems.push({
                input: Buffer.from(priceSvg),
                top: currentY,
                left: width - 280
              });
              
              currentY += (lineHeight * 2) + (item.marginBottom || 8);
            }
            break;
          
          case 'space':
            const lines = item.lines || 1;
            currentY += lines * 20;
            break;
          
          case 'line':
            const lineChar = item.char || '-';
            const lineLength = item.length || 40;
            const lineText = lineChar.repeat(lineLength);
            
            const lineSvg = `
              <svg width="${width}" height="20">
                <text x="20" y="14" 
                      font-family="Courier, monospace" 
                      font-size="12" 
                      fill="#000000">${lineText}</text>
              </svg>
            `;
            compositeItems.push({
              input: Buffer.from(lineSvg),
              top: currentY,
              left: 0
            });
            
            currentY += 20 + (item.marginBottom || 5);
            break;
        }
      } catch (error) {
        console.error(`${item.type} 처리 실패:`, error.message);
      }
    }
  }
  
  currentY += 40;
  
  console.log(`최종 이미지 크기: ${width}x${currentY}`);
  
  const receiptImage = await sharp({
    create: {
      width: width,
      height: currentY,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
  .composite(compositeItems)
  .png()
  .toBuffer();
  
  console.log('이미지 버퍼 크기:', receiptImage.length, 'bytes');
  fs.writeFileSync('debug_receipt.png', receiptImage);
  console.log('디버그 이미지 저장: debug_receipt.png');
  
  console.log('이미지 → ESC/POS 변환 시작...');
  
  let buffers = [];
  
  try {
    const processed = await sharp(receiptImage)
      .resize(576, null, { 
        fit: 'inside',
        kernel: 'nearest'
      })
      .sharpen()
      .grayscale()
      .linear(1.2, -(128 * 0.2))
      .threshold(120)
      .toFormat('png')
      .toBuffer();
    
    const png = PNG.sync.read(processed);
    const w = png.width;
    const h = png.height;
    
    console.log(`이미지 변환 완료: ${w}x${h}px`);
    
    const imageCommands = [];
    imageCommands.push(0x1D, 0x76, 0x30, 0x00);
    imageCommands.push((w / 8) & 0xFF, ((w / 8) >> 8) & 0xFF);
    imageCommands.push(h & 0xFF, (h >> 8) & 0xFF);
    
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x += 8) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          if (x + bit < w) {
            const idx = (y * w + x + bit) * 4;
            if (png.data[idx] < 128) {
              byte |= (1 << (7 - bit));
            }
          }
        }
        imageCommands.push(byte);
      }
    }
    
    const imageBuffer = Buffer.from(imageCommands);
    console.log('ESC/POS 변환 완료, 크기:', imageBuffer.length, 'bytes');
    
    buffers.push(Buffer.from([0x1B, 0x40]));
    buffers.push(Buffer.from([0x1B, 0x61, 0x01]));
    buffers.push(imageBuffer);
    buffers.push(Buffer.from([0x1B, 0x61, 0x00]));
    buffers.push(Buffer.from('\n\n\n\n'));
    buffers.push(Buffer.from([0x1D, 0x56, 0x00]));
    
  } catch (error) {
    console.error('이미지 변환 실패:', error.message);
    buffers.push(Buffer.from([0x1B, 0x40]));
    buffers.push(Buffer.from([0x1D, 0x56, 0x00]));
  }
  
  const final = Buffer.concat(buffers);
  console.log(`최종 버퍼 크기: ${final.length} bytes`);
  return final;
}

async function checkPrinterStatus() {
  return new Promise((resolve) => {
    exec('wmic printer get name', (error, stdout) => {
      const printers = stdout || '';
      resolve({ 
        barcode: { online: printers.includes(CONFIG.printers.barcode.name) },
        receipt: { online: printers.includes(CONFIG.printers.receipt.name) }
      });
    });
  });
}

function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url, true);
  console.log(`📡 요청: ${req.method} ${parsedUrl.pathname}`);

  // ✅ iOS 프로필 다운로드 라우트 (rootCA.pem 사용)
  if (parsedUrl.pathname === '/ios-profile' && req.method === 'GET') {
    try {
      console.log('📱 iOS 프로필 요청 받음');
      
      const certPath = path.join(__dirname, 'rootCA.pem');
      
      if (!fs.existsSync(certPath)) {
        console.error('❌ 루트 CA 파일 없음:', certPath);
        res.writeHead(404, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(JSON.stringify({error: '루트 CA 파일이 없습니다. 인증서-갱신.bat를 실행하세요.'}, null, 2));
        return;
      }
      
      const certContent = fs.readFileSync(certPath, 'utf8');
      
      const certBase64 = certContent
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/\n/g, '');
      
      const computerName = os.hostname();
      
      function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16).toUpperCase();
        });
      }
      
      const mobileConfig = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadCertificateFileName</key>
            <string>mkcert-root-ca.crt</string>
            <key>PayloadContent</key>
            <data>${certBase64}</data>
            <key>PayloadDescription</key>
            <string>mkcert 루트 인증 기관 - ${computerName}</string>
            <key>PayloadDisplayName</key>
            <string>mkcert 루트 CA</string>
            <key>PayloadIdentifier</key>
            <string>com.mkcert.rootca.${computerName}</string>
            <key>PayloadType</key>
            <string>com.apple.security.root</string>
            <key>PayloadUUID</key>
            <string>${generateUUID()}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>mkcert로 생성된 로컬 개발용 루트 인증서입니다. 이 프로필을 설치하면 ${computerName}.local의 HTTPS 서버를 신뢰할 수 있습니다.</string>
    <key>PayloadDisplayName</key>
    <string>🔐 mkcert 루트 CA - ${computerName}</string>
    <key>PayloadIdentifier</key>
    <string>com.mkcert.profile.${computerName}</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>${generateUUID()}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
    <key>PayloadOrganization</key>
    <string>mkcert development CA</string>
</dict>
</plist>`;
      
      console.log(`✅ iOS 프로필 생성 완료 (루트 CA): ${computerName}`);
      
      res.writeHead(200, {
        'Content-Type': 'application/x-apple-aspen-config',
        'Content-Disposition': `attachment; filename="mkcert-rootCA-${computerName}.mobileconfig"`,
        'Content-Length': Buffer.byteLength(mobileConfig, 'utf8')
      });
      res.end(mobileConfig);
      
      console.log(`📱 iOS 프로필 다운로드 완료: ${computerName}`);
      
    } catch (error) {
      console.error('❌ iOS 프로필 생성 오류:', error);
      res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
      res.end(JSON.stringify({error: error.message}, null, 2));
    }
    return;
  }

  // 🆕 안드로이드용 루트 CA 다운로드 (.crt)
  if (parsedUrl.pathname === '/android-cert' && req.method === 'GET') {
    try {
      console.log('🤖 안드로이드 인증서 요청 받음');
      
      const certPath = path.join(__dirname, 'rootCA.pem');
      
      if (!fs.existsSync(certPath)) {
        console.error('❌ 루트 CA 파일 없음:', certPath);
        res.writeHead(404, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(JSON.stringify({error: '루트 CA 파일이 없습니다. 인증서-갱신.bat를 실행하세요.'}, null, 2));
        return;
      }
      
      const certContent = fs.readFileSync(certPath, 'utf8');
      const computerName = os.hostname();
      
      res.writeHead(200, {
        'Content-Type': 'application/x-x509-ca-cert',
        'Content-Disposition': `attachment; filename="mkcert-rootCA-${computerName}.crt"`,
        'Content-Length': Buffer.byteLength(certContent, 'utf8')
      });
      res.end(certContent);
      
      console.log(`🤖 안드로이드 인증서 다운로드 완료: ${computerName}`);
      
    } catch (error) {
      console.error('❌ 안드로이드 인증서 오류:', error);
      res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
      res.end(JSON.stringify({error: error.message}, null, 2));
    }
    return;
  }

  // 큐 상태 확인
  if (parsedUrl.pathname === '/queue-status' && req.method === 'GET') {
    res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
    res.end(JSON.stringify({
      success: true,
      queues: {
        barcode: printerQueues.barcode.getStatus(),
        receipt: printerQueues.receipt.getStatus()
      },
      timestamp: new Date().toISOString()
    }, null, 2));
    return;
  }

  // 큐 초기화
  if (parsedUrl.pathname === '/queue-clear' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const queueName = data.queue || 'all';
        
        let cleared = {};
        if (queueName === 'all' || queueName === 'barcode') {
          cleared.barcode = printerQueues.barcode.clear();
        }
        if (queueName === 'all' || queueName === 'receipt') {
          cleared.receipt = printerQueues.receipt.clear();
        }
        
        res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(JSON.stringify({
          success: true,
          cleared,
          message: `큐 초기화 완료: ${queueName}`
        }, null, 2));
      } catch (error) {
        res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(JSON.stringify({success: false, message: error.message}, null, 2));
      }
    });
    return;
  }

  // 상태 확인
  if (parsedUrl.pathname === '/status' && req.method === 'GET') {
    checkPrinterStatus().then(status => {
      res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
      res.end(JSON.stringify({
        success: true,
        printers: status,
        server: 'v2.4 (iOS/Android 지원 + 큐)',
        ip: getLocalIPAddress(),
        hostname: os.hostname(),
        timestamp: new Date().toISOString()
      }, null, 2));
    });
    return;
  }

  // 바코드 출력 (큐 적용)
  if (parsedUrl.pathname === '/print' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        
        const jobId = await printerQueues.barcode.add({
          executor: async () => {
            return await printToWindowsShare(data.commands, CONFIG.printers.barcode);
          }
        });
        
        res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(JSON.stringify({
          success: true,
          jobId,
          message: '출력 작업이 큐에 추가되었습니다',
          queueLength: printerQueues.barcode.queue.length
        }, null, 2));
      } catch (error) {
        res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(JSON.stringify({success: false, message: error.message}, null, 2));
      }
    });
    return;
  }

  // 영수증 출력 (큐 적용)
  if (parsedUrl.pathname === '/print-receipt' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        
        const jobId = await printerQueues.receipt.add({
          executor: async () => {
            const commands = await generateReceiptFromLayout(data.receiptData);
            return await printToWindowsShare(commands, {
              name: data.printerName || CONFIG.printers.receipt.name,
              pc: data.printerPC || CONFIG.printers.receipt.pc,
              type: 'receipt'
            });
          }
        });
        
        res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(JSON.stringify({
          success: true,
          jobId,
          message: '출력 작업이 큐에 추가되었습니다',
          queueLength: printerQueues.receipt.queue.length
        }, null, 2));
      } catch (error) {
        res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(JSON.stringify({success: false, message: error.message}, null, 2));
      }
    });
    return;
  }

  // 메인 웹 인터페이스 (HTML - 길어서 생략됨, 원본과 동일)
  if (parsedUrl.pathname === '/' && req.method === 'GET') {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>프린터 서버 v2.4</title>
<style>
body{font-family:system-ui;margin:40px;background:#f5f7fa}
.container{max-width:900px;background:white;padding:30px;border-radius:10px;margin:0 auto}
.header{background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:20px;margin:-30px -30px 30px -30px;border-radius:10px 10px 0 0;text-align:center}
button{background:#667eea;color:white;border:none;padding:12px 24px;margin:10px 5px;border-radius:5px;cursor:pointer;transition:background 0.3s}
button:hover{background:#5a6fd8}
.ios-button{background:#007AFF;font-size:16px;padding:15px 30px;border-radius:8px}
.ios-button:hover{background:#0056CC}
.android-button{background:#3DDC84;font-size:16px;padding:15px 30px;border-radius:8px}
.android-button:hover{background:#2DBE6E}
.cert-section{background:#f8f9ff;border:2px solid #007AFF;border-radius:10px;padding:20px;margin:20px 0}
.android-section{background:#f0fff4;border:2px solid #3DDC84;border-radius:10px;padding:20px;margin:20px 0}
.guide-box{margin-top:15px;padding:15px;background:#fff3cd;border:1px solid #ffeaa7;border-radius:5px;font-size:14px}
.step{margin:5px 0;padding:5px 0}
#result{background:#f8f9fa;border:1px solid #ddd;padding:15px;margin-top:20px;white-space:pre-wrap;font-family:monospace;font-size:13px;display:none;max-height:500px;overflow-y:auto;border-radius:5px}
.test-section{background:#f8f9fa;padding:20px;border-radius:10px;margin:20px 0}
.status{padding:10px;background:#e8f5e8;border:1px solid #c3e6c3;border-radius:5px;margin:10px 0}
</style>
</head><body>
<div class="container">
<div class="header">
<h1>🖨️ 프린터 서버 v2.4</h1>
<p>바코드 + 영수증 + QR + iOS/Android 인증서 + 큐 시스템</p>
</div>

<div class="cert-section">
<h3>📱 iPhone/iPad 인증서 설치</h3>
<p style="color:#333;margin-bottom:15px;">
<strong>🚨 PWA에서 프린터 사용 시 필수!</strong><br>
이 인증서를 설치하면 모바일에서 영구적으로 프린터를 사용할 수 있습니다.
</p>
<button class="ios-button" onclick="downloadIOSProfile()">📱 iOS 프로필 다운로드</button>
<div class="guide-box">
<strong>📋 iOS 설치 방법:</strong>
<div class="step"><strong>1단계:</strong> 위 버튼으로 프로필 다운로드</div>
<div class="step"><strong>2단계:</strong> iPhone 설정 → 일반 → VPN 및 기기 관리</div>
<div class="step"><strong>3단계:</strong> 다운로드된 프로필에서 "mkcert 루트 CA" 선택</div>
<div class="step"><strong>4단계:</strong> "설치" 버튼 클릭 (암호 입력 필요)</div>
<div class="step"><strong>5단계:</strong> 설정 → 일반 → 정보 → 인증서 신뢰 설정</div>
<div class="step"><strong>6단계:</strong> "mkcert 루트 CA" 스위치 ON</div>
<div style="margin-top:10px;color:#d63384;"><strong>⚠️ 중요:</strong> 6단계를 꼭 해야 작동합니다!</div>
</div>
</div>

<div class="android-section">
<h3>🤖 Android 인증서 설치</h3>
<p style="color:#333;margin-bottom:15px;">
<strong>🚨 안드로이드에서도 인증서 필수!</strong><br>
안드로이드 PWA/브라우저에서 프린터를 사용할 수 있습니다.
</p>
<button class="android-button" onclick="downloadAndroidCert()">🤖 Android 인증서 다운로드 (.crt)</button>
<div class="guide-box">
<strong>📋 Android 설치 방법:</strong>
<div class="step"><strong>1단계:</strong> 위 버튼으로 rootCA.crt 다운로드</div>
<div class="step"><strong>2단계:</strong> 설정 → 보안 → 암호화 및 인증 정보</div>
<div class="step"><strong>3단계:</strong> 인증서 설치 → CA 인증서</div>
<div class="step"><strong>4단계:</strong> 다운로드한 파일 선택</div>
<div class="step"><strong>5단계:</strong> 이름 입력 (예: "프린터 서버") 후 확인</div>
<div style="margin-top:10px;color:#2d6a3e;"><strong>✅ 확인:</strong> 설정 → 보안 → 신뢰할 수 있는 인증서 → 사용자</div>
</div>
</div>

<div class="test-section">
<h3>🧪 프린터 테스트</h3>
<div class="status" id="printer-status">프린터 상태 확인 중...</div>
<button onclick="checkStatus()">🔍 상태 확인</button>
<button onclick="testBarcode()">📊 바코드 테스트</button>
<button onclick="testReceipt()">🧾 영수증 테스트</button>
<button onclick="testRealReceipt()">📋 실제 내역서 테스트</button>
</div>

<div id="result"></div>
</div>

<script>
function show(text) {
  const result = document.getElementById('result');
  result.style.display = 'block';
  result.textContent = text;
}

function downloadIOSProfile() {
  show('📱 iOS 프로필 다운로드 중...');
  window.location.href = '/ios-profile';
  setTimeout(() => {
    show('✅ iOS 프로필이 다운로드되었습니다!\\n\\niPhone/iPad에서 설정 → 일반 → VPN 및 기기 관리로 이동하여 설치해주세요.');
  }, 1000);
}

function downloadAndroidCert() {
  show('🤖 Android 인증서 다운로드 중...');
  window.location.href = '/android-cert';
  setTimeout(() => {
    show('✅ Android 인증서가 다운로드되었습니다!\\n\\n설정 → 보안 → 인증서 설치 → CA 인증서로 설치하세요.');
  }, 1000);
}

async function checkStatus() {
  show('🔍 프린터 상태 확인 중...');
  try {
    const r = await fetch('/status');
    const data = await r.json();
    show('📊 프린터 상태:\\n\\n' + JSON.stringify(data, null, 2));
    
    const statusDiv = document.getElementById('printer-status');
    if (data.success) {
      statusDiv.innerHTML = '✅ 서버 온라인 (v2.4) - 바코드: ' + 
        (data.printers.barcode.online ? '🟢 연결됨' : '🔴 연결 안됨') +
        ' | 영수증: ' + (data.printers.receipt.online ? '🟢 연결됨' : '🔴 연결 안됨');
      statusDiv.style.background = '#e8f5e8';
    } else {
      statusDiv.innerHTML = '🔴 서버 오프라인';
      statusDiv.style.background = '#f8e8e8';
    }
  } catch (e) {
    show('❌ 상태 확인 오류: ' + e.message);
    document.getElementById('printer-status').innerHTML = '❌ 연결 실패';
  }
}

async function testBarcode() {
  show('📊 바코드 출력 중...');
  try {
    const r = await fetch('/print', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        commands: 'SIZE 30 mm, 10 mm\\r\\nCLS\\r\\nTEXT 50,20,"3",0,1,1,"TEST"\\r\\nBARCODE 50,50,"128",40,1,0,2,2,"1234567890"\\r\\nPRINT 1,1\\r\\n',
        product: {code: 'TEST123'}
      })
    });
    const data = await r.json();
    show('📊 바코드 테스트 결과:\\n\\n' + JSON.stringify(data, null, 2));
  } catch (e) {
    show('❌ 바코드 테스트 오류: ' + e.message);
  }
}

async function testReceipt() {
  show('🧾 간단한 영수증 출력 중...');
  try {
    const r = await fetch('/print-receipt', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        receiptData: {
          layout: [
            {type: 'text', content: '🖨️ 프린터 테스트', align: 'center', bold: true, fontSize: 32},
            {type: 'text', content: '제주시 연동', align: 'center', fontSize: 24},
            {type: 'space', lines: 1},
            {type: 'line', char: '=', length: 40},
            {type: 'text', content: '감사합니다! 🙏', align: 'center', fontSize: 24}
          ]
        }
      })
    });
    const data = await r.json();
    show('🧾 간단한 영수증 테스트 결과:\\n\\n' + JSON.stringify(data, null, 2));
  } catch (e) {
    show('❌ 영수증 테스트 오류: ' + e.message);
  }
}

async function testRealReceipt() {
  show('📋 실제 내역서 출력 중...');
  try {
    const r = await fetch('/print-receipt', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        receiptData: {
          layout: [
            {type: 'text', content: 'AKOJEJU', align: 'center', bold: true, fontSize: 32},
            {type: 'text', content: '제주시 연동', align: 'center', fontSize: 24},
            {type: 'space', lines: 1},
            {type: 'text', content: '일자  2025-01-15', fontSize: 22},
            {type: 'text', content: '번호  TEST001', fontSize: 22},
            {type: 'space', lines: 1},
            {type: 'line', char: '=', length: 40},
            {type: 'product-line', name: '제주 감귤 5kg', quantity: 2, total: 30000, fontSize: 22},
            {type: 'product-line', name: '한라봉 3kg 선물세트', quantity: 1, total: 25000, fontSize: 22},
            {type: 'product-line', name: '제주 흑돼지 구이용 1kg 냉장포장', quantity: 1, total: 35000, fontSize: 22},
            {type: 'line', char: '=', length: 40},
            {type: 'product-line', name: '합계', quantity: 4, total: 90000, fontSize: 22},
            {type: 'space', lines: 2},
            {type: 'text', content: 'www.akojeju.com', align: 'center', fontSize: 22}
          ]
        }
      })
    });
    const data = await r.json();
    show('📋 실제 내역서 테스트 결과:\\n\\n' + JSON.stringify(data, null, 2));
  } catch (e) {
    show('❌ 실제 내역서 테스트 오류: ' + e.message);
  }
}

window.onload = function() {
  checkStatus();
};
</script>
</body></html>`;
    
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    res.end(html);
    return;
  }

  // 404 Not Found
  res.writeHead(404, {'Content-Type': 'application/json; charset=utf-8'});
  res.end(JSON.stringify({error: 'Not Found'}, null, 2));
}

// HTTP 서버 시작
console.log('🌐 HTTP 서버 시작...');
const httpServer = http.createServer(handleRequest);
httpServer.listen(CONFIG.httpPort, '0.0.0.0', () => {
  console.log(`✅ HTTP: http://localhost:${CONFIG.httpPort}`);
});

// HTTPS 서버 시작
console.log('🔒 HTTPS 서버 시작...');
const sslCert = loadSSLCert();
const localIP = getLocalIPAddress();
console.log(`📡 로컬 IP 주소: ${localIP}`);

if (sslCert) {
  const httpsServer = https.createServer(sslCert, handleRequest);
  httpsServer.listen(CONFIG.httpsPort, '0.0.0.0', () => {
    console.log(`✅ HTTPS: https://localhost:${CONFIG.httpsPort}`);
    console.log(`📱 iOS 프로필: https://localhost:${CONFIG.httpsPort}/ios-profile`);
    console.log(`🤖 Android 인증서: https://localhost:${CONFIG.httpsPort}/android-cert`);
    console.log(`🌐 로컬 네트워크: https://${localIP}:${CONFIG.httpsPort}`);
  });
} else {
  console.error('❌ HTTPS 서버 시작 실패 - 인증서 없음');
}

console.log('\n🎉 프린터 서버 v2.4 준비 완료!');
console.log('📱 iOS/Android 인증서 지원 + 실제 내역서 출력 + 프린터 큐');
console.log('🌐 웹 인터페이스에서 인증서를 다운로드하세요\n');