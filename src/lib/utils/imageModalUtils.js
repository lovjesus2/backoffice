// src/lib/utils/imageModalUtils.js - 수정된 버전 (productCode 방식)
import { writable } from 'svelte/store';

// 이미지 모달 스토어 - productData 대신 productCode 사용
export const imageModalStore = writable({
  show: false,
  imageSrc: null,
  imagePath: null,
  imageAlt: '',
  zIndex: 9999,
  productCode: null  // 🔄 변경: productData → productCode
});

// 이미지 모달 열기 - 수정된 함수
export function openImageModal(imageSrc, imageAlt = '이미지', productCode = null) {
  console.log('🖼️ 이미지 모달 열기:', { imageSrc, imageAlt, productCode });
  
  // imagePath 추출 (proxy URL에서)
  let imagePath = null;
  if (imageSrc && imageSrc.includes('/proxy-images/')) {
    imagePath = imageSrc.replace('/proxy-images/', '');
  }
  
  imageModalStore.set({
    show: true,
    imageSrc,
    imagePath,
    imageAlt,
    zIndex: 9999,
    productCode  // 🔄 변경: productData → productCode
  });
}

// 이미지 모달 닫기
export function closeImageModal() {
  console.log('❌ 이미지 모달 닫기');
  imageModalStore.set({
    show: false,
    imageSrc: null,
    imagePath: null,
    imageAlt: '',
    zIndex: 9999,
    productCode: null  // 🔄 변경: productData → productCode
  });
}

// 프록시 이미지 URL 생성
export function getProxyImageUrl(productCode, imageNumber = 1) {
  return `/proxy-images/${productCode}_${imageNumber}.jpg`;
}

// initAutoImageModal 함수 추가 (admin layout에서 사용)
export function initAutoImageModal(useProxy = false) {
  console.log('🚫 initAutoImageModal 비활성화 - 수동 제어 권장');
  return () => {}; // cleanup 함수 반환
}