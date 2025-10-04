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
  const certFile = 'localhost+2.pem';
  const keyFile = 'localhost+2-key.pem';
  
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

async function generateReceiptFromLayout(receiptData) {
  console.log(`영수증 생성 (${receiptData.layout?.length || 0}개)`);
  
  const buffers = [];
  
  buffers.push(Buffer.from([0x1B, 0x40])); // 초기화
  buffers.push(Buffer.from([0x1B, 0x74, 0x13])); // EUC-KR
  
  if (receiptData.layout && Array.isArray(receiptData.layout)) {
    for (const item of receiptData.layout) {
      console.log(`  ${item.type}`);
      
      switch (item.type) {
        case 'image':
          if (receiptData.images && receiptData.images[item.imageIndex]) {
            const imageCommands = await imageToESCPOS(receiptData.images[item.imageIndex]);
            
            if (item.align === 'center') buffers.push(Buffer.from([0x1B, 0x61, 0x01]));
            else if (item.align === 'right') buffers.push(Buffer.from([0x1B, 0x61, 0x02]));
            else buffers.push(Buffer.from([0x1B, 0x61, 0x00]));
            
            if (imageCommands.length > 0) {
              buffers.push(imageCommands);
              buffers.push(Buffer.from('\n'));
            }
          }
          break;
        
        case 'qrcode':
          if (item.data) {
            const qrCommands = await generateQRCodeESCPOS(item.data, {
              size: item.size || 256,
              errorCorrectionLevel: item.errorCorrectionLevel || 'H'
            });
            
            if (item.align === 'center') buffers.push(Buffer.from([0x1B, 0x61, 0x01]));
            else if (item.align === 'right') buffers.push(Buffer.from([0x1B, 0x61, 0x02]));
            else buffers.push(Buffer.from([0x1B, 0x61, 0x00]));
            
            if (qrCommands.length > 0) {
              buffers.push(qrCommands);
              buffers.push(Buffer.from('\n'));
            }
          }
          break;
        
        case 'text':
          if (item.align === 'center') buffers.push(Buffer.from([0x1B, 0x61, 0x01]));
          else if (item.align === 'right') buffers.push(Buffer.from([0x1B, 0x61, 0x02]));
          else buffers.push(Buffer.from([0x1B, 0x61, 0x00]));
          
          if (item.bold) buffers.push(Buffer.from([0x1B, 0x45, 0x01]));
          
          if (item.fontSize && item.fontSize > 1) {
            const size = Math.min(item.fontSize, 8);
            const sizeCode = ((size - 1) << 4) | (size - 1);
            buffers.push(Buffer.from([0x1D, 0x21, sizeCode]));
          }
          
          if (item.underline) buffers.push(Buffer.from([0x1B, 0x2D, 0x01]));
          
          const encodedText = iconv.encode(item.content || '', 'euc-kr');
          buffers.push(encodedText);
          buffers.push(Buffer.from('\n'));
          
          buffers.push(Buffer.from([0x1B, 0x45, 0x00, 0x1D, 0x21, 0x00, 0x1B, 0x2D, 0x00]));
          break;
        
        case 'line':
          buffers.push(Buffer.from([0x1B, 0x61, 0x00]));
          const lineText = (item.char || '=').repeat(item.length || 40);
          buffers.push(iconv.encode(lineText, 'euc-kr'));
          buffers.push(Buffer.from('\n'));
          break;
        
        case 'items':
          buffers.push(Buffer.from([0x1B, 0x61, 0x00]));
          if (item.items && Array.isArray(item.items)) {
            item.items.forEach(product => {
              buffers.push(iconv.encode(product.name || '', 'euc-kr'));
              buffers.push(Buffer.from('\n'));
              
              const price = (product.price || 0).toLocaleString();
              const priceText = `  ${price}원 x ${product.quantity || 1}`;
              buffers.push(iconv.encode(priceText, 'euc-kr'));
              buffers.push(Buffer.from('\n'));
            });
          }
          break;
        
        case 'space':
          buffers.push(Buffer.from('\n'.repeat(item.lines || 1)));
          break;
      }
    }
  }
  
  buffers.push(Buffer.from('\n\n'));
  buffers.push(Buffer.from([0x1D, 0x56, 0x00])); // 용지 커트
  
  const final = Buffer.concat(buffers);
  console.log(`완료 (${final.length} bytes)`);
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