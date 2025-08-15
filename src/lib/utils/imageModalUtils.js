// src/lib/utils/imageModalUtils.js - 정상 작동 버전
import { writable } from 'svelte/store';

// 전역 이미지 모달 상태
export const imageModalStore = writable({
  show: false,
  imageSrc: '',
  imagePath: '',
  imageAlt: '',
  zIndex: 50
});

/**
 * 이미지 모달을 여는 함수
 * @param {string} imageSrc - 이미지 URL (blob URL도 가능)
 * @param {string} imageAlt - 이미지 alt 텍스트 (선택사항)
 * @param {string} imagePath - 원본 이미지 경로 (선택사항, blob URL 문제 해결용)
 * @param {number} zIndex - z-index 값 (선택사항, 기본값: 50)
 */
export function openImageModal(imageSrc, imageAlt = '', imagePath = '', zIndex = 50) {
  if (!imageSrc || imageSrc.endsWith('/proxy-images/') || imageSrc === '') {
    console.warn('❌ 잘못된 이미지 URL:', imageSrc);
    return;
  }
  
  console.log('🎯 imageModalUtils: 모달 열기', { imageSrc, imagePath, imageAlt });
  
  imageModalStore.set({
    show: true,
    imageSrc,
    imagePath,
    imageAlt,
    zIndex
  });
}

/**
 * 이미지 모달을 닫는 함수
 */
export function closeImageModal() {
  imageModalStore.set({
    show: false,
    imageSrc: '',
    imagePath: '',
    imageAlt: '',
    zIndex: 50
  });
}

/**
 * 상품 이미지 URL을 생성하는 헬퍼 함수 (원본 서버)
 */
export function getProductImageUrl(productCode, imageNumber = 1) {
  if (!productCode || productCode === 'ZZ' || productCode === 'zz') {
    return null;
  }
  return `https://image.kungkungne.synology.me/${productCode}_${imageNumber}.jpg`;
}

/**
 * 프록시 이미지 URL을 생성하는 헬퍼 함수  
 */
export function getProxyImageUrl(productCode, imageNumber = 1) {
  if (!productCode || productCode === 'ZZ' || productCode === 'zz') {
    return null;
  }
  return `/proxy-images/${productCode}_${imageNumber}.jpg`;
}

/**
 * 이미지 클릭 핸들러를 생성하는 헬퍼 함수
 */
export function createImageClickHandler(productCode, productName = '', imageNumber = 1, useProxy = false, zIndex = 50) {
  return () => {
    const imageSrc = useProxy 
      ? getProxyImageUrl(productCode, imageNumber)
      : getProductImageUrl(productCode, imageNumber);
    
    if (imageSrc) {
      const imagePath = `${productCode}_${imageNumber}.jpg`;
      openImageModal(imageSrc, productName || productCode, imagePath, zIndex);
    }
  };
}

/**
 * 이미지 모달 상태를 구독하는 헬퍼 함수
 */
export function subscribeImageModal(callback) {
  return imageModalStore.subscribe(callback);
}

/**
 * 현재 이미지 모달 상태를 가져오는 함수
 */
export function getImageModalState() {
  let state;
  const unsubscribe = imageModalStore.subscribe(value => {
    state = value;
  });
  unsubscribe();
  return state;
}

// 자동 바인딩 함수들은 비활성화 (수동 제어 권장)
export function autoBindImageModal() {
  console.log('🚫 autoBindImageModal 비활성화 - 수동 제어 권장');
  return;
}

export function autoBindProductImages() {
  console.log('🚫 autoBindProductImages 비활성화 - 수동 제어 권장');
  return;
}

export function initAutoImageModal() {
  console.log('🚫 initAutoImageModal 비활성화 - 수동 제어 권장');
  return () => {};
}