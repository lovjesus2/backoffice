// 🖨️ 프린터 서버 v2.2 - 기존 내역서 기능 + iOS 인증서 프로필
// 바코드프린터/printer-server.js

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const { exec } = require('child_process');

const sharp = require('sharp');
const { PNG } = require('pngjs');
const QRCode = require('qrcode');
const iconv = require('iconv-lite');

process.stdout.setEncoding('utf8');
process.stderr.setEncoding('utf8');

console.log('🖨️ 프린터 서버 v2.2 시작 (iOS 인증서 지원)');

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
    
    // Sharp로 처리 (더 선명하게)
    const processed = await sharp(qrBuffer)
      .resize(size, size, { 
        fit: 'contain',
        kernel: 'nearest' // 픽셀 보존
      })
      .grayscale()
      .normalise() // 명암 정규화
      .threshold(128) // 흑백 변환
      .toFormat('png')
      .toBuffer();
    
    const png = PNG.sync.read(processed);
    const width = png.width;
    const height = png.height;
    
    console.log(`QR코드 완료: ${width}x${height}px`);
    
    // ESC/POS GS v 0 명령어
    const result = [];
    result.push(0x1D, 0x76, 0x30, 0x00); // GS v 0 m
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

// XML 이스케이프 함수
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 🔄 기존 복잡한 영수증 레이아웃 처리 함수 (그대로 유지)
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
              
              // Base64 디코딩
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
              
              // 먼저 리사이즈
              const resizedLogo = await sharp(logoBuffer)
                .resize(item.width || 300, null, { 
                  fit: 'inside',
                  //withoutEnlargement: true  // 원본보다 크게 안 함
                })
                .toBuffer();
                
              const logoMeta = await sharp(resizedLogo).metadata();
              console.log(`리사이즈된 로고 크기: ${logoMeta.width}x${logoMeta.height}`);
              
              let finalLogo = resizedLogo;
              
              // QR 코드 + 텍스트 합성
              if (item.qrData && (item.qrX !== undefined || item.qrY !== undefined)) {
                try {
                  const qrSize = item.qrSize || 100;
                  const qrX = parseInt(item.qrX) || 0;
                  const qrY = parseInt(item.qrY) || 0;
                  const qrText = item.qrText || '';
                  const qrTextSize = item.qrTextSize || 14;
                  
                  console.log(`QR 합성: 위치(${qrX}, ${qrY}), 크기(${qrSize})`);
                  
                  // QR 코드 생성
                  const qrBuffer = await QRCode.toBuffer(item.qrData, {
                    errorCorrectionLevel: 'M',
                    type: 'png',
                    width: qrSize,
                    margin: 2  // 👈 1 → 2로 변경
                  });

                  // Sharp로 QR 코드 선명하게 처리
                  const enhancedQR = await sharp(qrBuffer)
                    .sharpen()
                    .toBuffer();

                  const compositeItems = [
                    // QR 코드
                    {
                      input: enhancedQR,  // 👈 qrBuffer → enhancedQR로 변경
                      top: qrY,
                      left: qrX
                    }
                    
                  ];
                  
                  // QR 텍스트가 있으면 추가
                  if (qrText) {
                    const textY = qrY + qrSize + 5; // QR 아래 5px 간격
                    const textWidth = qrSize * 2; // QR 코드 폭의 2배로 설정
                    const textX = qrX - (qrSize / 2); // 좌우 중앙 정렬을 위해 왼쪽으로 이동
                    
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
                  
                  // 리사이즈된 이미지에 QR + 텍스트 합성
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
              
              // ⭐ 함수 호출
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
              

              // 글자 수 고정 (폰트 크기별)
              let maxCharsPerLine;
              if (fontSize <= 12) {
                maxCharsPerLine = 18;
              } else if (fontSize <= 15) {
                maxCharsPerLine = 16;  // 15pt는 16자
              } else {
                maxCharsPerLine = 14;
              }
              
              // 품목명을 두 줄로 분리
              let line1 = item.name.substring(0, maxCharsPerLine);
              let line2 = item.name.length > maxCharsPerLine ? 
                          item.name.substring(maxCharsPerLine, maxCharsPerLine * 2) : '';

              // ⭐ 이스케이프
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
    // 원본 크기 유지하고 8의 배수로만 조정
    const processed = await sharp(receiptImage)
      .resize(576, null, { 
        fit: 'inside',
        kernel: 'nearest'  // 픽셀 보존, 번짐 방지
      })
      .sharpen()
      .grayscale()
      .linear(1.2, -(128 * 0.2))  // 명암 대비 증가
      .threshold(120)  // 128 → 120 (더 진하게)
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
  // CORS 헤더 설정
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

  // ✅ iOS 프로필 다운로드 라우트 (새로 추가)
  if (parsedUrl.pathname === '/ios-profile' && req.method === 'GET') {
    try {
      console.log('📱 iOS 프로필 요청 받음');
      
      // 인증서 파일 읽기
      const certPath = path.join(__dirname, 'localhost+2.pem');
      
      if (!fs.existsSync(certPath)) {
        console.error('❌ 인증서 파일 없음:', certPath);
        res.writeHead(404, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(JSON.stringify({error: '인증서 파일이 없습니다'}, null, 2));
        return;
      }
      
      const certContent = fs.readFileSync(certPath, 'utf8');
      
      // PEM 인증서를 Base64로 변환 (헤더/푸터 제거)
      const certBase64 = certContent
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/\n/g, '');
      
      // 현재 컴퓨터명 가져오기
      const computerName = os.hostname();
      
      // UUID 생성 함수
      function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16).toUpperCase();
        });
      }
      
      // iOS 구성 프로필 XML 생성
      const mobileConfig = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>PayloadCertificateFileName</key>
            <string>printer-server-cert.crt</string>
            <key>PayloadContent</key>
            <data>${certBase64}</data>
            <key>PayloadDescription</key>
            <string>프린터 서버 인증서 - ${computerName}.local 접속용</string>
            <key>PayloadDisplayName</key>
            <string>프린터 서버 인증서</string>
            <key>PayloadIdentifier</key>
            <string>com.printerserver.certificate.${computerName}</string>
            <key>PayloadType</key>
            <string>com.apple.security.root</string>
            <key>PayloadUUID</key>
            <string>${generateUUID()}</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>프린터 서버(${computerName}.local:8443)에 안전하게 연결하기 위한 인증서입니다. 이 프로필을 설치하면 PWA에서 프린터를 영구적으로 사용할 수 있습니다.</string>
    <key>PayloadDisplayName</key>
    <string>🖨️ 프린터 서버 - ${computerName}</string>
    <key>PayloadIdentifier</key>
    <string>com.printerserver.profile.${computerName}</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>${generateUUID()}</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
    <key>PayloadOrganization</key>
    <string>프린터 서버</string>
</dict>
</plist>`;
      
      console.log(`✅ iOS 프로필 생성 완료: ${computerName}`);
      
      res.writeHead(200, {
        'Content-Type': 'application/x-apple-aspen-config',
        'Content-Disposition': `attachment; filename="printer-${computerName}.mobileconfig"`,
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

  // 🔄 기존 기능들 (그대로 유지)
  
  // 상태 확인
  if (parsedUrl.pathname === '/status' && req.method === 'GET') {
    checkPrinterStatus().then(status => {
      res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
      res.end(JSON.stringify({
        success: true,
        printers: status,
        server: 'v2.2 (iOS 지원)',
        timestamp: new Date().toISOString()
      }, null, 2));
    });
    return;
  }

  // 바코드 출력
  if (parsedUrl.pathname === '/print' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const result = await printToWindowsShare(data.commands, CONFIG.printers.barcode);
        
        res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(JSON.stringify(result, null, 2));
      } catch (error) {
        res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(JSON.stringify({success: false, message: error.message}, null, 2));
      }
    });
    return;
  }

  // 🔄 영수증 출력 (기존 복잡한 기능 그대로 유지)
  if (parsedUrl.pathname === '/print-receipt' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const commands = await generateReceiptFromLayout(data.receiptData);
        const result = await printToWindowsShare(commands, {
          name: data.printerName || CONFIG.printers.receipt.name,
          pc: data.printerPC || CONFIG.printers.receipt.pc,
          type: 'receipt'
        });
        
        res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(JSON.stringify(result, null, 2));
      } catch (error) {
        res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
        res.end(JSON.stringify({success: false, message: error.message}, null, 2));
      }
    });
    return;
  }

  // 메인 웹 인터페이스 (iOS 프로필 다운로드 포함)
  if (parsedUrl.pathname === '/' && req.method === 'GET') {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>프린터 서버</title>
<style>
body{font-family:system-ui;margin:40px;background:#f5f7fa}
.container{max-width:900px;background:white;padding:30px;border-radius:10px;margin:0 auto}
.header{background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:20px;margin:-30px -30px 30px -30px;border-radius:10px 10px 0 0;text-align:center}
button{background:#667eea;color:white;border:none;padding:12px 24px;margin:10px 5px;border-radius:5px;cursor:pointer;transition:background 0.3s}
button:hover{background:#5a6fd8}
.ios-button{background:#007AFF;font-size:16px;padding:15px 30px;border-radius:8px}
.ios-button:hover{background:#0056CC}
.ios-section{background:#f8f9ff;border:2px solid #007AFF;border-radius:10px;padding:20px;margin:20px 0}
.guide-box{margin-top:15px;padding:15px;background:#fff3cd;border:1px solid #ffeaa7;border-radius:5px;font-size:14px}
.step{margin:5px 0;padding:5px 0}
#result{background:#f8f9fa;border:1px solid #ddd;padding:15px;margin-top:20px;white-space:pre-wrap;font-family:monospace;font-size:13px;display:none;max-height:500px;overflow-y:auto;border-radius:5px}
.test-section{background:#f8f9fa;padding:20px;border-radius:10px;margin:20px 0}
.status{padding:10px;background:#e8f5e8;border:1px solid #c3e6c3;border-radius:5px;margin:10px 0}
</style>
</head><body>
<div class="container">
<div class="header">
<h1>🖨️ 프린터 서버 v2.2</h1>
<p>바코드 + 영수증 + QR + iOS 인증서 + 실제 내역서</p>
</div>

<div class="ios-section">
<h3>📱 iPhone/iPad 인증서 설치</h3>
<p style="color:#333;margin-bottom:15px;">
<strong>🚨 PWA에서 프린터 사용 시 필수!</strong><br>
이 인증서를 설치하면 모바일에서 영구적으로 프린터를 사용할 수 있습니다.
</p>
<button class="ios-button" onclick="downloadIOSProfile()">📱 iOS 프로필 다운로드</button>
<div class="guide-box">
<strong>📋 설치 방법:</strong>
<div class="step"><strong>1단계:</strong> 위 버튼으로 프로필 다운로드</div>
<div class="step"><strong>2단계:</strong> iPhone 설정 → 일반 → VPN 및 기기 관리</div>
<div class="step"><strong>3단계:</strong> 다운로드된 프로필에서 "프린터 서버" 선택</div>
<div class="step"><strong>4단계:</strong> "설치" 버튼 클릭 (암호 입력 필요)</div>
<div class="step"><strong>5단계:</strong> 일반 → 정보 → 인증서 신뢰 설정</div>
<div class="step"><strong>6단계:</strong> "프린터 서버 인증서" 스위치 ON</div>
<div style="margin-top:10px;color:#d63384;"><strong>⚠️ 중요:</strong> 6단계를 꼭 해야 작동합니다!</div>
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

// iOS 프로필 다운로드
function downloadIOSProfile() {
  show('📱 iOS 프로필 다운로드 중...');
  window.location.href = '/ios-profile';
  setTimeout(() => {
    show('✅ iOS 프로필이 다운로드되었습니다!\\n\\niPhone/iPad에서 설정 → 일반 → VPN 및 기기 관리로 이동하여 설치해주세요.');
  }, 1000);
}

// 상태 확인
async function checkStatus() {
  show('🔍 프린터 상태 확인 중...');
  try {
    const r = await fetch('/status');
    const data = await r.json();
    show('📊 프린터 상태:\\n\\n' + JSON.stringify(data, null, 2));
    
    const statusDiv = document.getElementById('printer-status');
    if (data.success) {
      statusDiv.innerHTML = '✅ 서버 온라인 (v2.2) - 바코드: ' + 
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

// 바코드 테스트
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

// 간단한 영수증 테스트
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

// 실제 내역서 테스트 (복잡한 레이아웃)
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

// 페이지 로드 시 상태 확인
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
if (sslCert) {
  const httpsServer = https.createServer(sslCert, handleRequest);
  httpsServer.listen(CONFIG.httpsPort, '0.0.0.0', () => {
    console.log(`✅ HTTPS: https://localhost:${CONFIG.httpsPort}`);
    console.log(`📱 iOS 프로필: https://localhost:${CONFIG.httpsPort}/ios-profile`);
  });
} else {
  console.error('❌ HTTPS 서버 시작 실패 - 인증서 없음');
}

console.log('\n🎉 프린터 서버 v2.2 준비 완료!');
console.log('📱 iOS 인증서 지원 + 실제 내역서 출력 기능');
console.log('🌐 웹 인터페이스에서 iOS 프로필을 다운로드하세요\n');