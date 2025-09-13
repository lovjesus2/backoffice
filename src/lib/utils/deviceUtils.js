// src/lib/utils/deviceUtils.js (새로 생성)
export function getDeviceType() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isPWA = window.navigator.standalone;
  
  return {
    isIOS,
    isPWA,
    isIOSPWA: isIOS && isPWA
  };
}

//아이폰 Safari와, pwa 차이변수(Safari 경우 아래 쪽에 추가 공간이 있음)
export function getLayoutConstants() {
  const { isIOSPWA } = getDeviceType();
  
  return {
    headerPadding: isIOSPWA ? '10px' : '60px',
    //아이폰 백오피스 헤더 포함 값
    safeAreaTop: isIOSPWA 
      ? 'calc(env(safe-area-inset-top, 0px) + 40px)'
      : 'calc(env(safe-area-inset-top, 0px) + 40px)',
      //아이폰 사이드메뉴 백오피스 헤더 + 메뉴헤더 포함값 
      sideMenuTop: isIOSPWA
      ? 'calc(env(safe-area-inset-top, 0px) + 120px)' // 추가 여백
      : 'calc(env(safe-area-inset-top, 0px) + 120px)',
      //아이폰 사이드 메뉴 height
      sideMenuHeight: isIOSPWA
      ? 'calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 150px)' // 추가 여백
      : 'calc(100vh - env(safe-area-inset-top, 0px) - 150px)',
      //아이폰 사이드 메뉴 목록 height
      listMaxHeight: isIOSPWA
      ? 'calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 300px)' // 더 많은 여백
      : 'calc(100vh - env(safe-area-inset-top, 0px) - 300px)'
    // 다른 상수들도 추가 가능
  };
}