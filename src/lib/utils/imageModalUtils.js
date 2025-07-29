// src/lib/utils/imageModalUtils.js
import { writable } from 'svelte/store';

// 전역 이미지 모달 상태
export const imageModalStore = writable({
  show: false,
  imageSrc: '',
  imageAlt: '',
  zIndex: 50
});

/**
 * 이미지 모달을 여는 함수
 * @param {string} imageSrc - 이미지 URL
 * @param {string} imageAlt - 이미지 alt 텍스트 (선택사항)
 * @param {number} zIndex - z-index 값 (선택사항, 기본값: 50)
 */
export function openImageModal(imageSrc, imageAlt = '', zIndex = 50) {
  if (!imageSrc) {
    console.warn('이미지 URL이 제공되지 않았습니다.');
    return;
  }
  
  imageModalStore.set({
    show: true,
    imageSrc,
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
    imageAlt: '',
    zIndex: 50
  });
}

/**
 * 상품 이미지 URL을 생성하는 헬퍼 함수 (원본 서버)
 * @param {string} productCode - 상품 코드
 * @param {number} imageNumber - 이미지 번호 (기본값: 1)
 * @returns {string|null} 완전한 이미지 URL 또는 null
 */
export function getProductImageUrl(productCode, imageNumber = 1) {
  if (!productCode || productCode === 'ZZ' || productCode === 'zz') {
    return null;
  }
  return `https://image.kungkungne.synology.me/${productCode}_${imageNumber}.jpg`;
}

/**
 * 프록시 이미지 URL을 생성하는 헬퍼 함수  
 * @param {string} productCode - 상품 코드
 * @param {number} imageNumber - 이미지 번호 (기본값: 1)
 * @returns {string|null} 프록시 이미지 URL 또는 null
 */
export function getProxyImageUrl(productCode, imageNumber = 1) {
  if (!productCode || productCode === 'ZZ' || productCode === 'zz') {
    return null;
  }
  return `/proxy-images/${productCode}_${imageNumber}.jpg`;
}

/**
 * 이미지 클릭 핸들러를 생성하는 헬퍼 함수
 * @param {string} productCode - 상품 코드
 * @param {string} productName - 상품명 (선택사항)
 * @param {number} imageNumber - 이미지 번호 (기본값: 1)
 * @param {boolean} useProxy - 프록시 이미지 사용 여부 (기본값: false)
 * @param {number} zIndex - z-index 값 (선택사항, 기본값: 50)
 * @returns {Function} 클릭 핸들러 함수
 */
export function createImageClickHandler(productCode, productName = '', imageNumber = 1, useProxy = false, zIndex = 50) {
  return () => {
    const imageSrc = useProxy 
      ? getProxyImageUrl(productCode, imageNumber)
      : getProductImageUrl(productCode, imageNumber);
    
    if (imageSrc) {
      openImageModal(imageSrc, productName || productCode, zIndex);
    }
  };
}

/**
 * 이미지 요소에 클릭 이벤트를 자동으로 추가하는 함수
 * @param {HTMLElement} containerElement - 이미지가 포함된 컨테이너 요소
 * @param {string} imageSelector - 이미지 선택자 (기본값: 'img')
 * @param {Function} getImageInfo - 이미지 정보를 추출하는 함수 (선택사항)
 */
export function autoBindImageModal(containerElement, imageSelector = 'img', getImageInfo = null) {
  if (!containerElement) {
    console.warn('컨테이너 요소가 제공되지 않았습니다.');
    return;
  }

  const images = containerElement.querySelectorAll(imageSelector);
  
  images.forEach(img => {
    // 이미 바인딩된 경우 중복 방지
    if (img.dataset.modalBound) return;
    
    img.style.cursor = 'pointer';
    img.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      let imageSrc = img.src;
      let imageAlt = img.alt;
      
      // 커스텀 정보 추출 함수가 있으면 사용
      if (getImageInfo && typeof getImageInfo === 'function') {
        try {
          const info = getImageInfo(img);
          imageSrc = info.src || imageSrc;
          imageAlt = info.alt || imageAlt;
        } catch (error) {
          console.warn('이미지 정보 추출 중 오류:', error);
        }
      }
      
      openImageModal(imageSrc, imageAlt);
    });
    
    // 호버 효과 추가
    img.addEventListener('mouseenter', () => {
      img.style.opacity = '0.8';
      img.style.transition = 'opacity 0.2s ease';
    });
    
    img.addEventListener('mouseleave', () => {
      img.style.opacity = '1';
    });
    
    img.dataset.modalBound = 'true';
  });
}

/**
 * 컨테이너 내의 모든 상품 이미지에 자동으로 모달 바인딩
 * @param {HTMLElement} containerElement - 컨테이너 요소
 * @param {boolean} useProxy - 프록시 이미지 사용 여부 (기본값: true)
 */
export function autoBindProductImages(containerElement, useProxy = true) {
  if (!containerElement) return;

  // 상품 이미지 선택자들
  const selectors = [
    'img[src*="kungkungne.synology.me"]',
    'img[src*="/proxy-images/"]',
    'img[alt*="상품"]',
    'img[alt*="제품"]',
    '.product-image img',
    '.item-image img',
    '.sales-item img'
  ];

  selectors.forEach(selector => {
    autoBindImageModal(containerElement, selector, (img) => {
      // 상품 코드 추출 시도
      let productCode = null;
      let productName = img.alt || '';

      // 1. data 속성에서 추출
      const itemElement = img.closest('[data-item-code], [data-product-code], [data-code]');
      if (itemElement) {
        productCode = itemElement.dataset.itemCode || 
                     itemElement.dataset.productCode || 
                     itemElement.dataset.code;
      }

      // 2. 이미지 src에서 추출
      if (!productCode) {
        const srcMatch = img.src.match(/\/([A-Z0-9]+)_\d+\.jpg/i);
        if (srcMatch) {
          productCode = srcMatch[1];
        }
      }

      // 3. 인근 텍스트에서 추출
      if (!productCode) {
        const parent = img.closest('.product-item, .sales-item, .item');
        if (parent) {
          const codeElement = parent.querySelector('.product-code, .item-code, .code');
          if (codeElement) {
            productCode = codeElement.textContent.trim();
          }
        }
      }

      // 이미지 URL 결정
      let imageSrc = img.src;
      if (productCode) {
        imageSrc = useProxy 
          ? getProxyImageUrl(productCode) 
          : getProductImageUrl(productCode);
      }

      return {
        src: imageSrc,
        alt: productName
      };
    });
  });
}

/**
 * 이미지 모달 상태를 구독하는 헬퍼 함수
 * @param {Function} callback - 상태 변경 콜백 함수
 * @returns {Function} 구독 해제 함수
 */
export function subscribeImageModal(callback) {
  return imageModalStore.subscribe(callback);
}

/**
 * 현재 이미지 모달 상태를 가져오는 함수
 * @returns {Object} 현재 상태
 */
export function getImageModalState() {
  let state;
  const unsubscribe = imageModalStore.subscribe(value => {
    state = value;
  });
  unsubscribe();
  return state;
}

/**
 * 페이지 로드 후 자동으로 모든 상품 이미지에 모달 바인딩
 * @param {boolean} useProxy - 프록시 이미지 사용 여부 (기본값: true)
 */
export function initAutoImageModal(useProxy = true) {
  if (typeof window === 'undefined') return;

  const bindAllImages = () => {
    autoBindProductImages(document.body, useProxy);
  };

  // DOM이 로드되면 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAllImages);
  } else {
    bindAllImages();
  }

  // 동적으로 추가되는 이미지들을 위한 MutationObserver
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.tagName === 'IMG') {
            // 단일 이미지가 추가된 경우
            autoBindImageModal(node.parentElement, 'img');
          } else {
            // 컨테이너가 추가된 경우
            autoBindProductImages(node, useProxy);
          }
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // 정리 함수 반환
  return () => {
    observer.disconnect();
  };
}