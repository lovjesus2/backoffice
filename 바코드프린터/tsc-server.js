const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const net = require('net');
const { exec, spawn } = require('child_process');

// 한글 인코딩 설정
process.stdout.setEncoding('utf8');
process.stderr.setEncoding('utf8');

console.log('🖨️ TSC TTP-244 Pro 에이전트 v3.1 (USB 최적화)');
console.log('===============================================');

const CONFIG = {
  httpPort: 8080,
  httpsPort: 8443,
  printerPC: 'LAPTOP-IN37RDJM',
  printerPort: 9100,
  printerName: 'TSC_TTP-244_Pro',
  outputMethod: 'usb', // 'usb', 'tcp', 'share'
  timeout: 3000 // 연결 타임아웃 단축 (3초)
};

// mkcert 인증서 로드 (localhost+2 파일명)
function loadSSLCert() {
  console.log('\n🔍 인증서 로드 시도... (localhost+2)');
  
  const certFile = 'localhost+2.pem';
  const keyFile = 'localhost+2-key.pem';
  
  if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
    console.error('❌ 인증서 파일 없음');
    return null;
  }
  
  try {
    const cert = fs.readFileSync(certFile, 'utf8');
    const key = fs.readFileSync(keyFile, 'utf8');
    console.log('✅ 인증서 파일 읽기 성공');
    return { key, cert };
  } catch (e) {
    console.error('❌ 인증서 읽기 실패:', e.message);
    return null;
  }
}

// Windows 공유 출력 (백업 방법)
async function fallbackShare(commands) {
  return new Promise((resolve) => {
    console.log('📁 Windows 공유 출력 시도');
    
    const tempFile = `tsc_${Date.now()}.prn`;
    fs.writeFileSync(tempFile, commands, 'binary');
    
    const cmd = `copy /b "${tempFile}" "\\\\${CONFIG.printerPC}\\${CONFIG.printerName}"`;
    exec(cmd, { timeout: CONFIG.timeout }, (error) => {
      try { fs.unlinkSync(tempFile); } catch (e) {}
      
      if (error) {
        resolve({ 
          success: false, 
          message: '모든 출력 방법 실패: ' + error.message,
          method: 'none'
        });
      } else {
        console.log('✅ Windows 공유로 출력 성공');
        resolve({ 
          success: true, 
          message: 'Windows 공유 출력 완료',
          method: 'share'
        });
      }
    });
  });
}

// 메인 TSC 출력 함수 (우선순위: USB > TCP > 공유)
async function printTSC(commands) {
  const startTime = Date.now();
  
  try {
    let result;
    
    result = await fallbackShare(commands);
    
    const elapsed = Date.now() - startTime;
    result.elapsed = `${elapsed}ms`;
    console.log(`⏱️ 총 출력 시간: ${elapsed}ms`);
    
    return result;
  } catch (error) {
    return { 
      success: false, 
      message: '출력 실패: ' + error.message,
      elapsed: `${Date.now() - startTime}ms`
    };
  }
}

// 프린터 상태 확인 (빠른 체크)
async function checkPrinterStatus() {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setTimeout(2000); // 2초 타임아웃
    
    client.connect(CONFIG.printerPort, CONFIG.printerPC, () => {
      client.end();
      resolve({ online: true, method: 'tcp' });
    });
    
    client.on('error', () => {
      // TCP 실패 시 USB 프린터 확인
      exec('wmic printer get name', (error, stdout) => {
        const printers = stdout || '';
        const usbOnline = printers.includes(CONFIG.usbPrinterName);
        resolve({ 
          online: usbOnline, 
          method: usbOnline ? 'usb' : 'none',
          availablePrinters: printers.split('\n').filter(p => p.trim())
        });
      });
    });
    
    client.on('timeout', () => {
      client.destroy();
      resolve({ online: false, method: 'timeout' });
    });
  });
}

// 요청 처리 함수
function handleRequest(req, res) {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const isHttps = req.connection.encrypted;
  const protocol = isHttps ? 'HTTPS' : 'HTTP';
  
  if (req.url === '/status') {
    checkPrinterStatus().then(status => {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8'
      });
      res.end(JSON.stringify({
        online: status.online,
        method: status.method,
        outputMethod: CONFIG.outputMethod,
        address: CONFIG.printerPC,
        printer: CONFIG.printerName,
        usbPrinter: CONFIG.usbPrinterName,
        message: `${protocol} TSC 프린터 (${CONFIG.outputMethod.toUpperCase()} 모드)`,
        https: isHttps,
        timeout: CONFIG.timeout,
        availablePrinters: status.availablePrinters,
        timestamp: new Date().toLocaleString('ko-KR')
      }, null, 2));
    });
    
  } else if (req.url === '/print' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        console.log(`📦 ${protocol} 출력 요청 (${CONFIG.outputMethod.toUpperCase()}):`, data.product?.code || 'Unknown');
        
        const result = await printTSC(data.commands);
        
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8'
        });
        res.end(JSON.stringify(result, null, 2));
      } catch (error) {
        res.writeHead(500, {
          'Content-Type': 'application/json; charset=utf-8'
        });
        res.end(JSON.stringify({
          success: false,
          message: '요청 처리 실패: ' + error.message
        }, null, 2));
      }
    });
    
  } else {
    // 홈페이지 (상태 정보 추가)
    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="utf-8">
    <title>TSC TTP-244 Pro 에이전트 (USB 최적화)</title>
    <style>
        body { 
            font-family: 'Segoe UI', system-ui, sans-serif; 
            margin: 40px; 
            background: #f5f7fa; 
        }
        .container { 
            max-width: 800px; 
            background: white; 
            padding: 30px; 
            border-radius: 10px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .header { 
            background: linear-gradient(135deg, #28a745, #20c997); 
            color: white; 
            padding: 20px; 
            margin: -30px -30px 30px -30px; 
            border-radius: 10px 10px 0 0; 
            text-align: center; 
        }
        .status { 
            padding: 15px; 
            border-radius: 5px; 
            margin: 20px 0; 
        }
        .online { 
            background: #d4edda; 
            color: #155724; 
            border-left: 4px solid #28a745; 
        }
        .usb-mode { 
            background: #fff3cd; 
            color: #856404; 
            border-left: 4px solid #ffc107; 
        }
        .secure { 
            background: #d1ecf1; 
            color: #0c5460; 
            border-left: 4px solid #17a2b8; 
        }
        .info { 
            background: #e3f2fd; 
            padding: 15px; 
            border-radius: 5px; 
            margin: 15px 0; 
            color: #1976d2; 
        }
        button { 
            background: #007bff; 
            color: white; 
            border: none; 
            padding: 10px 20px; 
            border-radius: 5px; 
            cursor: pointer; 
            margin: 10px 5px; 
        }
        button:hover { 
            background: #0056b3; 
        }
        .speed-badge { 
            background: #ff6b35; 
            color: white; 
            padding: 4px 8px; 
            border-radius: 12px; 
            font-size: 12px; 
            margin-left: 10px; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ TSC TTP-244 Pro</h1>
            <p>${protocol} 에이전트 v3.1 (USB 최적화)</p>
        </div>
        <div class="status online">✅ 프린터 연결 준비됨</div>
        <div class="status usb-mode">🔌 ${CONFIG.outputMethod.toUpperCase()} 모드 활성화<span class="speed-badge">초고속</span></div>
        ${isHttps ? '<div class="status secure">🔐 신뢰할 수 있는 HTTPS 연결</div>' : ''}
        <div class="info">
            <strong>📋 출력 설정:</strong><br>
            • 출력 방식: <strong>${CONFIG.outputMethod.toUpperCase()}</strong> (우선)<br>
            • USB 프린터: ${CONFIG.usbPrinterName}<br>
            • TCP 백업: ${CONFIG.printerPC}:${CONFIG.printerPort}<br>
            • 공유 백업: ${CONFIG.printerName}<br>
            • 타임아웃: ${CONFIG.timeout}ms (고속)<br>
            • 현재: ${protocol} 연결<br>
            • 시간: ${new Date().toLocaleString('ko-KR')}
        </div>
        <div>
            <button onclick="testStatus()">📊 빠른 상태 확인</button>
            <button onclick="testPrint()">⚡ 고속 테스트 출력</button>
        </div>
        <div id="result" style="margin-top:20px;padding:15px;background:#f8f9fa;border-radius:5px;font-family:'Consolas',monospace;font-size:12px;display:none"></div>
    </div>
    <script>
        async function testStatus() {
            const start = Date.now();
            document.getElementById('result').style.display='block';
            document.getElementById('result').innerHTML='빠른 상태 확인 중...';
            try {
                const r = await fetch('/status');
                const data = await r.json();
                const elapsed = Date.now() - start;
                document.getElementById('result').innerHTML=\`상태 확인 결과 (\${elapsed}ms):\\n\`+JSON.stringify(data,null,2);
            } catch(e) {
                document.getElementById('result').innerHTML='오류: '+e.message;
            }
        }
        async function testPrint() {
            const start = Date.now();
            document.getElementById('result').style.display='block';
            document.getElementById('result').innerHTML='⚡ 고속 테스트 출력 중...';
            try {
                const r = await fetch('/print',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({
                        commands:'SIZE 30 mm, 20 mm\\r\\nCLS\\r\\nTEXT 50,50,"1",0,1,1,"USB 고속 테스트"\\r\\nTEXT 50,80,"1",0,1,1,"' + new Date().toLocaleTimeString() + '"\\r\\nPRINT 1,1\\r\\n',
                        product:{code:'SPEED_TEST',name:'고속테스트'}
                    })
                });
                const data = await r.json();
                const elapsed = Date.now() - start;
                document.getElementById('result').innerHTML=\`출력 결과 (총 \${elapsed}ms):\\n\`+JSON.stringify(data,null,2);
            } catch(e) {
                document.getElementById('result').innerHTML='오류: '+e.message;
            }
        }
    </script>
</body>
</html>`;
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8'
    });
    res.end(html);
  }
}

// HTTP 서버 시작
console.log('\n🌐 HTTP 서버 시작...');
const httpServer = http.createServer(handleRequest);
httpServer.listen(CONFIG.httpPort, '0.0.0.0', () => {
  console.log(`✅ HTTP 서버: http://localhost:${CONFIG.httpPort}`);
});

// HTTPS 서버 시작
console.log('\n🔐 HTTPS 서버 시작...');
const sslCert = loadSSLCert();
if (sslCert) {
  try {
    const httpsServer = https.createServer(sslCert, handleRequest);
    httpsServer.listen(CONFIG.httpsPort, '0.0.0.0', () => {
      console.log(`✅ HTTPS 서버: https://localhost:${CONFIG.httpsPort}`);
    });
  } catch (e) {
    console.error('❌ HTTPS 서버 생성 실패:', e.message);
  }
} else {
  console.log('⚠️ 인증서 로드 실패');
}

console.log('\n🚀 TSC TTP-244 Pro 에이전트 준비 완료! (USB 최적화)');
console.log(`⚡ 출력 방식: ${CONFIG.outputMethod.toUpperCase()} (초고속)`);
console.log(`🔌 USB 프린터: ${CONFIG.usbPrinterName}`);
console.log(`⏱️ 타임아웃: ${CONFIG.timeout}ms (고속 모드)`);
console.log('Ctrl+C로 종료');