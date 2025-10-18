// src/lib/stores/openPagesStore.js (새 파일 생성)
import { writable } from 'svelte/store';
import { goto } from '$app/navigation';

export const openPages = writable(new Set(['/admin'])); // 대시보드는 기본으로 열림
export const currentPage = writable('/admin');

export function openPage(href) {
  openPages.update(pages => {
    const newPages = new Set(pages);
    newPages.add(href);
    return newPages;
  });
  currentPage.set(href);
}

export function closePage(href) {
  // 대시보드는 닫을 수 없음
  if (href === '/admin') return;
  
  openPages.update(pages => {
    const newPages = new Set(pages);
    newPages.delete(href);
    return newPages;
  });
  
  // 현재 페이지가 닫히는 경우 대시보드로 이동
  currentPage.update(current => {
    if (current === href) {
      return '/admin';
    }
    return current;
  });
}