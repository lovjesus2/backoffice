const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const sharp = require('sharp');
const { PNG } = require('pngjs');
const QRCode = require('qrcode');
const iconv = require('iconv-lite');

process.stdout.setEncoding('utf8');
process.stderr.setEncoding('utf8');

console.log('프린터 서버 v2.1 시작');

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
  console.log('인증서 로드 중...');
  const certFile = 'localhost.pem';
  const keyFile = 'llocalhost-key.pem';
  
  if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
    console.error('인증서 파일 없음');
    return null;
  }
  
  try {
    const cert = fs.readFileSync(certFile, 'utf8');
    const key = fs.readFileSync(keyFile, 'utf8');
    console.log('인증서 로드 성공');
    return { key, cert };
  } catch (e) {
    console.error('인증서 읽기 실패:', e.message);
    return null;
  }
}

async function printToWindowsShare(commands, printerConfig) {
  return new Promise((resolve) => {
    const printerName = printerConfig.name;
    const printerPC = printerConfig.pc;
    
    console.log(`프린터 출력: \\\\${printerPC}\\${printerName}`);
    
    const tempFile = `print_${Date.now()}.prn`;
    
    try {
      fs.writeFileSync(tempFile, commands, 'binary');
      console.log(`임시 파일: ${tempFile} (${commands.length} bytes)`);
    } catch (writeError) {
      console.error('파일 생성 실패:', writeError.message);
      resolve({ success: false, message: writeError.message });
      return;
    }
    
    const cmd = `copy /b "${tempFile}" "\\\\${printerPC}\\${printerName}"`;
    
    exec(cmd, { timeout: CONFIG.timeout }, (error, stdout, stderr) => {
      try { fs.unlinkSync(tempFile); } catch (e) {}
      
      if (error) {
        console.error('출력 실패:', error.message);
        resolve({ success: false, message: error.message });
      } else {
        console.log('출력 성공');
        resolve({ success: true, message: '출력 완료' });
      }
    });
  });
}

async function imageToESCPOS(imagePath) {
  try {
    console.log(`이미지 처리: ${imagePath}`);
    
    if (!fs.existsSync(imagePath)) {
      console.error('이미지 없음:', imagePath);
      return Buffer.alloc(0);
    }
    
    const imageBuffer = fs.readFileSync(imagePath);
    const processed = await sharp(imageBuffer)
      .resize(384, null, { fit: 'inside' })
      .grayscale()
      .threshold(128)
      .toFormat('png')
      .toBuffer();
    
    const png = PNG.sync.read(processed);
    const width = png.width;
    const height = png.height;
    
    console.log(`이미지 변환: ${width}x${height}px`);
    
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
    console.error('이미지 변환 실패:', error.message);
    return Buffer.alloc(0);
  }
}

async function generateQRCodeESCPOS(qrData, options = {}) {
  try {
    console.log(`QR코드 생성: ${qrData}`);
    
    // QR코드를 더 크게 생성 (256x256)
    const size = options.size || 256;
    
    const qrBuffer = await QRCode.toBuffer(qrData, {
      width: size,
      margin: 2,
      errorCorrectionLevel: options.errorCorrectionLevel || 'H', // 높은 오류 수정
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

// ⭐ 여기에 추가 (generateReceiptFromLayout 함수 바로 위)
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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
                .resize(item.width || 300, null, { fit: 'inside' })
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url === '/status') {
    checkPrinterStatus().then(status => {
      res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
      res.end(JSON.stringify(status, null, 2));
    });
    return;
  }
  
  if (req.url === '/print' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        console.log('바코드 출력:', data.product?.code);
        
        const result = await printToWindowsShare(data.commands, {
          name: data.printerName || CONFIG.printers.barcode.name,
          pc: data.printerPC || CONFIG.printers.barcode.pc,
          type: 'barcode'
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
  
  if (req.url === '/print-receipt' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        console.log('영수증 출력');
        
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
  
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>프린터 서버</title>
<style>body{font-family:system-ui;margin:40px;background:#f5f7fa}.container{max-width:900px;background:white;padding:30px;border-radius:10px}.header{background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:20px;margin:-30px -30px 30px -30px;border-radius:10px 10px 0 0;text-align:center}button{background:#667eea;color:white;border:none;padding:12px 24px;margin:10px 5px;border-radius:5px;cursor:pointer}#result{background:#f8f9fa;border:1px solid #ddd;padding:15px;margin-top:20px;white-space:pre-wrap;font-family:monospace;font-size:13px;display:none;max-height:500px;overflow-y:auto}</style>
</head><body><div class="container"><div class="header"><h1>프린터 서버 v2.1</h1><p>바코드 + 영수증 + QR</p></div><h3>테스트</h3>
<button onclick="testBarcode()">바코드 테스트</button>
<button onclick="testReceipt()">영수증 (한글)</button>
<button onclick="testQR()">영수증 + QR</button>
<div id="result"></div></div>
<script>
async function testBarcode(){show('바코드 출력 중...');try{const r=await fetch('/print',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({commands:'SIZE 30 mm, 10 mm\\r\\nCLS\\r\\nTEXT 50,20,"3",0,1,1,"TEST"\\r\\nBARCODE 50,50,"128",40,1,0,2,2,"1234567890"\\r\\nPRINT 1,1\\r\\n',product:{code:'TEST123'}})});const data=await r.json();show('결과:\\n\\n'+JSON.stringify(data,null,2));}catch(e){show('오류: '+e.message);}}
async function testReceipt(){show('영수증 출력 중...');try{const r=await fetch('/print-receipt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receiptData:{images:[],layout:[{type:'text',content:'비숍매장',align:'center',bold:true,fontSize:2},{type:'text',content:'제주시 XXX',align:'center'},{type:'space',lines:1},{type:'line',char:'=',length:40},{type:'items',items:[{name:'테스트 상품1',price:10000,quantity:2},{name:'테스트 상품2',price:15000,quantity:1}]},{type:'line',char:'=',length:40},{type:'text',content:'합계: 35,000원',align:'right',bold:true,fontSize:2},{type:'text',content:'감사합니다',align:'center'}]}})});const data=await r.json();show('결과:\\n\\n'+JSON.stringify(data,null,2));}catch(e){show('오류: '+e.message);}}
async function testQR(){show('QR 출력 중...');try{const r=await fetch('/print-receipt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receiptData:{images:[],layout:[{type:'text',content:'비숍매장',align:'center',bold:true,fontSize:2},{type:'text',content:'제주시 XXX',align:'center'},{type:'space',lines:1},{type:'line',char:'=',length:40},{type:'items',items:[{name:'테스트 상품1',price:10000,quantity:2}]},{type:'line',char:'=',length:40},{type:'text',content:'합계: 20,000원',align:'right',bold:true,fontSize:2},{type:'space',lines:2},{type:'text',content:'영수증 확인',align:'center'},{type:'space',lines:1},{type:'qrcode',data:'https://bishop.com/receipt/12345',size:256,errorCorrectionLevel:'H'},{type:'space',lines:1},{type:'text',content:'감사합니다',align:'center',bold:true}]}})});const data=await r.json();show('결과:\\n\\n'+JSON.stringify(data,null,2));}catch(e){show('오류: '+e.message);}}
function show(text){const r=document.getElementById('result');r.style.display='block';r.textContent=text;}
</script></body></html>`;
  
  res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  res.end(html);
}

console.log('HTTP 서버 시작...');
const httpServer = http.createServer(handleRequest);
httpServer.listen(CONFIG.httpPort, '0.0.0.0', () => {
  console.log(`HTTP: http://localhost:${CONFIG.httpPort}`);
});

console.log('HTTPS 서버 시작...');
const sslCert = loadSSLCert();
if (sslCert) {
  const httpsServer = https.createServer(sslCert, handleRequest);
  httpsServer.listen(CONFIG.httpsPort, '0.0.0.0', () => {
    console.log(`HTTPS: https://localhost:${CONFIG.httpsPort}`);
  });
}

console.log('준비 완료\n');