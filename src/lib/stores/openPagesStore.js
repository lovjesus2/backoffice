// src/lib/stores/openPagesStore.js
import { writable } from 'svelte/store';

export const openPages = writable(new Set(['/admin']));
export const currentPage = writable('/admin');

export function openPage(href) {
  openPages.update(pages => {
    // 이미 존재하는 페이지면 기존 Set 그대로 반환 (업데이트 방지)
    if (pages.has(href)) {
      return pages;
    }
    
    // 새로운 페이지인 경우에만 새 Set 생성
    const newPages = new Set(pages);
    newPages.add(href);
    return newPages;
  });
  
  // currentPage도 같은 값이면 업데이트하지 않음
  currentPage.update(current => {
    return current === href ? current : href;
  });
}

export function closePage(href) {
  if (href === '/admin') return;
  
  openPages.update(pages => {
    if (!pages.has(href)) {
      return pages; // 존재하지 않으면 기존 Set 반환
    }
    
    const newPages = new Set(pages);
    newPages.delete(href);
    return newPages;
  });
  
  currentPage.update(current => {
    if (current === href) {
      return '/admin';
    }
    return current;
  });
}