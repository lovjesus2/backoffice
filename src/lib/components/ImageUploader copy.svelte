<!-- src/lib/components/ImageUploader.svelte -->
<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import { browser } from '$app/environment';
  
  // Props
  export let imagGub1 = '';
  export let imagGub2 = '';  
  export let imagCode = '';
  export let maxFiles = 10;
  export let allowResize = true;
  export let defaultWidth = 300;
  export let defaultHeight = 300;
  export let quality = 0.8;
  export let images = [];
  export let disabled = false;
  export let placeholder = "이미지를 업로드하세요";
  
  // 컴포넌트 참조
  let pondElement;
  let pond = null;
  let enableResize = allowResize;
  let uploading = false;
  let uploadProgress = 0;
  let initializationError = null;
  let isLibraryLoaded = false;
  let successMessage = '';
  let errorMessage = '';
  
  let showResizeOptions = false; // 리사이즈 옵션 표시 여부 추가
  
  // 옵션 토글 함수 추가
  function toggleResizeOptions() {
    showResizeOptions = !showResizeOptions;
  }

  // 리사이즈 설정
  let resizeMode = 'contain'; // 'contain' (축소) 또는 'cover' (자르기)
  let selectedWidth = defaultWidth;
  let selectedHeight = defaultHeight;
  let showCustomSize = false;
  let customWidth = 300;
  let customHeight = 300;
  
  // 빠른 선택 크기들
  const quickSizes = [
    { label: '300×300', width: 300, height: 300 },
    { label: '400×400', width: 400, height: 400 },
    { label: '500×500', width: 500, height: 500 }
  ];
  
  // 통합 이미지 배열
  let allImages = [];  
  let selectedImageIndex = null;
  
  // 개선된 터치 드래그 관련 변수들
  let draggedIndex = null;
  let isDragging = false;
  let dragMode = false;
  let touchStartX = 0;
  let touchStartY = 0;
  let currentTouchX = 0;
  let currentTouchY = 0;
  let longPressTimer = null;
  let isDragMoving = false;
  let draggedElement = null;
  let dragPlaceholder = null;
  let floatingDragElement = null;
  let lastDragEndTime = 0;
  
  // 파일 드래그 상태 (+ 버튼 전용)
  let isFileDragOver = false;
  
  // 로딩 상태
  let isLoadingImages = false;
  let lastLoadedKey = '';

  // 변환된 파일을 저장할 Map
  let processedFiles = new Map();
  
  const dispatch = createEventDispatcher();
  
  // 기존/새 이미지 분리된 뷰
  $: existingImages = allImages.filter(img => img.isExisting);
  $: newImages = allImages.filter(img => !img.isExisting);
  $: images = allImages;
  
  // 컴포넌트 마운트 시 초기화
  onMount(async () => {
    if (!browser) return;
    
    // 상태 초기화
    isLoadingImages = false;
    lastLoadedKey = '';
    allImages = [];
    
    try {
      initializationError = null;
      await initializeFilePond();
    } catch (error) {
      initializationError = error.message;
      dispatch('error', { message: 'FilePond 초기화에 실패했습니다.' });
    }
    
    // 이벤트 리스너 설정
    const handleBeforeUnload = () => resetTouchDragState();
    const handleOrientationChange = () => resetTouchDragState();
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      resetTouchDragState();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  });

  // 3. 단순한 FilePond 초기화 (복잡한 iOS 코드 제거)
  async function initializeFilePond() {
    if (!window.FilePond) {
      let waitTime = 0;
      while (!window.FilePond && waitTime < 10000) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitTime += 100;
      }
      
      if (!window.FilePond) {
        throw new Error('FilePond 라이브러리를 찾을 수 없습니다');
      }
    }
    
    if (!pondElement) {
      throw new Error('FilePond DOM 요소가 준비되지 않았습니다');
    }
    
    pond = window.FilePond.create(pondElement, {
      allowMultiple: true,
      maxFiles: maxFiles,
      acceptedFileTypes: ['image/*'],
      maxFileSize: '10MB',
      labelIdle: `드래그 앤 드롭하거나 <span class="filepond--label-action">${placeholder}</span>`,
      
      allowDrop: true,
      allowBrowse: true,
      allowRemove: true,
      allowReorder: false,
      allowProcess: false,
      
      dropOnPage: false,
      dropOnElement: true,
      dropValidation: true,
      
      itemInsertLocation: 'after',
      
      // 리사이즈 설정
      // ⬇️ 리사이즈 완전 비활성화
      imageResizeTargetWidth: null,
      imageResizeTargetHeight: null,
      imageResizeMode: resizeMode,
      imageResizeUpscale: false,
     // imageResizeBackgroundColor: '#ffffff',
      
      imageTransformOutputMimeType: 'image/jpeg',
      imageTransformOutputQuality: quality,
      imageTransformOutputStrip: true,
      imageTransformClientTransforms: [], // ← 변환 비활성화
      
      instantUpload: false,
      credits: false,
      server: null,
      
      // 간단한 콜백들
      onaddfile: (error, file) => {
        if (error) {
          console.error('파일 추가 오류:', error);
          return;
        }
        console.log('파일 추가됨:', file.filename);
        syncNewImagesFromPond();
      },
      
      onremovefile: (error, file) => {
        if (error) return;
        console.log('파일 제거됨:', file.filename);
        syncNewImagesFromPond();
      },
      
      onupdatefiles: (fileItems) => {
        console.log('onupdatefiles 콜백:', fileItems.length);
        // 즉시 동기화
        syncNewImagesFromPond();
      },

      onpreparefile: (fileItem, outputFile) => {
        console.log('이미지 변환 완료:', {
          filename: fileItem.filename,
          originalSize: fileItem.file ? fileItem.file.size : 'N/A',
          resizedSize: outputFile ? outputFile.size : 'N/A'
        });
        
        // 변환된 파일을 Map에 저장
        if (outputFile && enableResize) {
          processedFiles.set(fileItem.filename, outputFile);
        }
      },
      
      onerror: (error) => {
        console.error('FilePond 오류:', error);
        errorMessage = error.body || error.main || '알 수 없는 오류가 발생했습니다.';
        setTimeout(() => errorMessage = '', 5000);
      }
    });
    
    isLibraryLoaded = true;
    
    if (imagGub1 && imagGub2 && imagCode) {
      await loadExistingImages();
    }
  }

  // ✅ 추가: 동기식 리사이즈 함수
  async function resizeImageSync(file) {
    if (!enableResize) {
      return file; // 리사이즈 비활성화면 원본 반환
    }
    
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = selectedWidth;
        canvas.height = selectedHeight;
        ctx.drawImage(img, 0, 0, selectedWidth, selectedHeight);
        
        canvas.toBlob((blob) => {
          // 원본 파일명 유지
          const resizedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve(resizedFile);
        }, 'image/jpeg', quality);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }
  
  // 리사이즈 설정 업데이트
  function updateResizeSettings() {
    if (!pond || !enableResize) return;
    
    try {
      pond.setOptions({
        imageResizeTargetWidth: null,  // ← 비활성화
        imageResizeTargetHeight: null, // ← 비활성화
        imageResizeMode: resizeMode,
        imageTransformClientTransforms: [] // ← 변환 완전 비활성화
      });
      
      console.log('FilePond 리사이즈 비활성화 - 수동 리사이즈만 사용');
    } catch (error) {
      console.warn('설정 업데이트 실패:', error);
    }
  }
  
  // 빠른 크기 선택
  function selectQuickSize(size) {
    selectedWidth = size.width;
    selectedHeight = size.height;
    showCustomSize = false;
    updateResizeSettings();
    
    successMessage = `크기가 ${size.width}×${size.height}로 설정되었습니다.`;
    setTimeout(() => successMessage = '', 2000);
  }
  
  // 사용자 정의 크기 적용
  function applyCustomSize() {
    if (customWidth < 50 || customWidth > 2000 || customHeight < 50 || customHeight > 2000) {
      errorMessage = '크기는 50px에서 2000px 사이로 설정해주세요.';
      setTimeout(() => errorMessage = '', 3000);
      return;
    }
    
    selectedWidth = customWidth;
    selectedHeight = customHeight;
    showCustomSize = false;
    updateResizeSettings();
    
    successMessage = `사용자 정의 크기 ${customWidth}×${customHeight}가 적용되었습니다.`;
    setTimeout(() => successMessage = '', 2000);
  }
  
  // 리사이즈 모드 변경
  function changeResizeMode(mode) {
    resizeMode = mode;
    updateResizeSettings();
  }
  
  // 리사이즈 토글
  function toggleResize() {
    enableResize = !enableResize;
    
    if (pond && typeof pond.setOptions === 'function') {
      try {
        if (enableResize) {
          pond.setOptions({
            imageResizeTargetWidth: selectedWidth,
            imageResizeTargetHeight: selectedHeight,
            imageResizeMode: resizeMode,
            imageTransformClientTransforms: []
          });
        } else {
          pond.setOptions({
            imageResizeTargetWidth: null,
            imageResizeTargetHeight: null,
            imageTransformClientTransforms: []
          });
        }
      } catch (error) {
        console.warn('리사이즈 토글 실패:', error);
      }
    }
  }
  
  // ========== 기존 드래그 로직들 ==========
  
  // 터치 시작 - 길게 누르기 감지
  function handleTouchStart(event, index) {
    if (event.target.closest('button')) return;
    
    resetTouchDragState();
    
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    currentTouchX = touch.clientX;
    currentTouchY = touch.clientY;
    draggedIndex = index;
    
    longPressTimer = setTimeout(() => {
      dragMode = true;
      isDragMoving = false;
      
      const element = event.currentTarget;
      draggedElement = element;
      
      startDragVisualFeedback(element, index);
      
      if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
      }
      
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    }, 300);
  }

  function handleTouchMove(event) {
    if (draggedIndex === null) return;
    
    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartX);
    const deltaY = Math.abs(touch.clientY - touchStartY);
    const totalDelta = deltaX + deltaY;
    
    if (!dragMode && totalDelta > 10) {
      resetTouchDragState();
      return;
    }
    
    if (dragMode) {
      event.preventDefault();
      event.stopPropagation();
      
      currentTouchX = touch.clientX;
      currentTouchY = touch.clientY;
      isDragMoving = true;
      
      updateDraggedElementPosition(touch.clientX, touch.clientY);
      const dropTarget = findDropTarget(touch.clientX, touch.clientY);
      updateDropTargetHighlight(dropTarget);
    }
  }

  function handleTouchEnd(event) {
    clearTimeout(longPressTimer);
    
    if (!dragMode) {
      resetTouchDragState();
      return;
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    let dropIndex = null;
    
    if (isDragMoving) {
      const touch = event.changedTouches[0];
      dropIndex = findDropIndex(touch.clientX, touch.clientY);
    }
    
    completeDragOperation(dropIndex);
    lastDragEndTime = Date.now();
    resetTouchDragState();
  }

  function startDragVisualFeedback(element, index) {
    if (!element) return;
    
    element.style.opacity = '0.3';
    element.style.transform = 'scale(0.95)';
    element.style.transition = 'all 0.2s ease';
    element.style.zIndex = '999';
    
    createDragPlaceholder(element);
    createFloatingDragElement(element);
  }

  function createDragPlaceholder(element) {
    const rect = element.getBoundingClientRect();
    
    dragPlaceholder = document.createElement('div');
    dragPlaceholder.className = element.className;
    dragPlaceholder.style.opacity = '0.5';
    dragPlaceholder.style.background = 'linear-gradient(45deg, #e3f2fd, #bbdefb)';
    dragPlaceholder.style.border = '2px dashed #2196f3';
    dragPlaceholder.style.borderRadius = '8px';
    dragPlaceholder.style.transform = 'scale(0.98)';
    dragPlaceholder.style.minHeight = `${rect.height}px`;
    dragPlaceholder.style.display = 'flex';
    dragPlaceholder.style.alignItems = 'center';
    dragPlaceholder.style.justifyContent = 'center';
    dragPlaceholder.innerHTML = `
      <div class="text-blue-500 text-sm font-bold text-center">
        <div class="animate-pulse">📱</div>
        <div class="mt-1">드래그 중...</div>
      </div>
    `;
    dragPlaceholder.setAttribute('data-placeholder', 'true');
    
    element.parentNode.insertBefore(dragPlaceholder, element.nextSibling);
  }

  function createFloatingDragElement(element) {
    const rect = element.getBoundingClientRect();
    
    floatingDragElement = element.cloneNode(true);
    floatingDragElement.style.position = 'fixed';
    floatingDragElement.style.pointerEvents = 'none';
    floatingDragElement.style.zIndex = '9999';
    floatingDragElement.style.opacity = '0.9';
    floatingDragElement.style.transform = 'scale(1.1) rotate(3deg)';
    floatingDragElement.style.boxShadow = '0 15px 35px rgba(0,0,0,0.4), 0 5px 15px rgba(0,0,0,0.2)';
    floatingDragElement.style.borderRadius = '12px';
    floatingDragElement.style.transition = 'none';
    floatingDragElement.style.border = '3px solid #2196f3';
    floatingDragElement.setAttribute('data-floating-drag', 'true');
    
    floatingDragElement.style.left = `${currentTouchX - rect.width / 2}px`;
    floatingDragElement.style.top = `${currentTouchY - rect.height / 2}px`;
    floatingDragElement.style.width = `${rect.width}px`;
    floatingDragElement.style.height = `${rect.height}px`;
    
    document.body.appendChild(floatingDragElement);
  }

  function updateDraggedElementPosition(x, y) {
    if (!floatingDragElement) return;
    
    const rect = floatingDragElement.getBoundingClientRect();
    floatingDragElement.style.left = `${x - rect.width / 2}px`;
    floatingDragElement.style.top = `${y - rect.height / 2}px`;
    
    const rotationAngle = Math.sin(Date.now() / 200) * 5;
    floatingDragElement.style.transform = `scale(1.1) rotate(${rotationAngle}deg)`;
  }

  function findDropTarget(x, y) {
    const elements = document.querySelectorAll('[data-image-index]:not([data-placeholder]):not([data-floating-drag])');
    
    for (let el of elements) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && 
          y >= rect.top && y <= rect.bottom) {
        return el;
      }
    }
    return null;
  }

  function updateDropTargetHighlight(targetElement) {
    document.querySelectorAll('[data-image-index]').forEach(el => {
      if (!el.hasAttribute('data-floating-drag') && !el.hasAttribute('data-placeholder')) {
        el.style.backgroundColor = '';
        el.style.borderColor = '';
        el.style.outline = '';
      }
    });
    
    if (targetElement) {
      targetElement.style.backgroundColor = '#fff3e0';
      targetElement.style.borderColor = '#ff9800';
      targetElement.style.outline = '3px solid #ff9800';
      targetElement.style.transition = 'all 0.2s ease';
    }
  }

  function findDropIndex(x, y) {
    const elements = document.querySelectorAll('[data-image-index]:not([data-placeholder]):not([data-floating-drag])');
    
    for (let el of elements) {
      const index = parseInt(el.getAttribute('data-image-index'));
      if (index === draggedIndex) continue;
      
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && 
          y >= rect.top && y <= rect.bottom) {
        return index;
      }
    }
    return null;
  }

  function completeDragOperation(dropIndex) {
    if (dropIndex !== null && dropIndex !== draggedIndex) {
      reorderImages(draggedIndex, dropIndex);
      
      if (navigator.vibrate) {
        navigator.vibrate([30, 20, 30]);
      }
      
      successMessage = '이미지 순서가 변경되었습니다!';
      setTimeout(() => successMessage = '', 2000);
    } else {
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    }
  }

  function resetTouchDragState() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    
    if (floatingDragElement) {
      floatingDragElement.remove();
      floatingDragElement = null;
    }
    
    if (dragPlaceholder) {
      dragPlaceholder.remove();
      dragPlaceholder = null;
    }
    
    document.querySelectorAll('[data-image-index]').forEach(el => {
      el.style.opacity = '';
      el.style.transform = '';
      el.style.transition = '';
      el.style.zIndex = '';
      el.style.backgroundColor = '';
      el.style.borderColor = '';
      el.style.outline = '';
    });
    
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    
    dragMode = false;
    isDragMoving = false;
    draggedIndex = null;
    draggedElement = null;
    touchStartX = 0;
    touchStartY = 0;
    currentTouchX = 0;
    currentTouchY = 0;
  }
  
  // ========== 기존 함수들 계속 ==========
  
  async function loadExistingImages() {
    const currentKey = `${imagGub1}-${imagGub2}-${imagCode}`;
    
    if (!imagGub1 || !imagGub2 || !imagCode) {
      allImages = [];
      isLoadingImages = false;
      lastLoadedKey = '';
      return;
    }

    // ✅ 추가: 캐시 무효화
    if (typeof window !== 'undefined' && window.simpleCache && imagCode) {
      try {
        await window.simpleCache.invalidateProductCache(imagCode);
        console.log('🗑️ ImageUploader 캐시 무효화:', imagCode);
      } catch (err) {
        console.warn('캐시 무효화 실패:', err);
      }
    }
    
    //중복 로딩 방지 및 상태 초기화
    if (isLoadingImages) {
      console.warn('이미 로딩 중', '강제 초기화');
      isLoadingImages = false;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    isLoadingImages = true;
    
    try {
      const params = new URLSearchParams({
        IMAG_GUB1: imagGub1,
        IMAG_GUB2: imagGub2,
        IMAG_CODE: imagCode,
        t: Date.now()
      });
      
      const response = await fetch(`/api/images/upload?${params}`, {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.images && result.images.length > 0) {
        const validImages = result.images.filter(img => img.exists !== false);
        
        validImages.sort((a, b) => {
          const aNum = parseInt(a.cnt || '0', 10);
          const bNum = parseInt(b.cnt || '0', 10);
          return aNum - bNum;
        });
        
        const loadedImages = validImages.map((img, index) => ({
          ...img,
          url: img.name.startsWith('/') ? 
          `${img.name}?t=${Date.now()}` :  // ✅ 타임스탬프 추가
          `/proxy-images/${img.name}?t=${Date.now()}`,
          isExisting: true,
          originalIndex: index,
          loadTime: Date.now(),
          width: null,
          height: null,
          uniqueId: `existing_${index}_${Date.now()}`
        }));
        
        allImages = [...loadedImages, ...newImages];
      } else {
        allImages = [...newImages];
      }
      
      lastLoadedKey = currentKey;
      preloadImageResolutions();
      
    } catch (error) {
      console.error('이미지 로드 실패:', error);
      errorMessage = '기존 이미지 로드에 실패했습니다.';
      setTimeout(() => errorMessage = '', 3000);
      allImages = [...newImages];
    } finally {
      isLoadingImages = false;
    }
  }
  
  function preloadImageResolutions() {
    allImages.forEach((img, index) => {
      if (img.url && !img.width && !img.height && img.isExisting) {
        const imgElement = new Image();
        imgElement.onload = function() {
          allImages[index] = {
            ...allImages[index],
            width: imgElement.naturalWidth,
            height: imgElement.naturalHeight
          };
          allImages = [...allImages];
        };
        const url = new URL(img.url, window.location.origin);
        url.searchParams.set('nocache', Date.now());
        imgElement.src = url.toString();
      }
    });
  }
  
  // 1. 간단하고 안정적인 syncNewImagesFromPond 함수
  function syncNewImagesFromPond() {
    if (!pond) return;
    
    try {
      const files = pond.getFiles();
      const currentNewImages = allImages.filter(img => !img.isExisting);
      
      const pondFileNames = files.map(f => f.filename);
      const currentNewFileNames = currentNewImages.map(img => img.name);
      
      const newFiles = files.filter(f => !currentNewFileNames.includes(f.filename));
      const removedFileNames = currentNewFileNames.filter(name => !pondFileNames.includes(name));
      
      if (newFiles.length > 0 || removedFileNames.length > 0) {
        // 제거된 파일들 필터링
        let updatedImages = allImages.filter(img => 
          img.isExisting || !removedFileNames.includes(img.name)
        );
        
        // 새 파일들 추가
        const newImageObjects = newFiles.map((fileItem) => {
          let url = null;
          
          if (fileItem.file && (fileItem.file instanceof File || fileItem.file instanceof Blob)) {
            try {
              url = URL.createObjectURL(fileItem.file);
              
              // 이미지 해상도 로딩
              const img = new Image();
              img.onload = function() {
                updateImageResolution(fileItem.filename, img.naturalWidth, img.naturalHeight);
              };
              img.src = url;
            } catch (error) {
              console.warn('URL 생성 실패:', error);
            }
          }
          
          return {
            name: fileItem.filename,
            file: fileItem.file,
            url: url,
            serverId: fileItem.serverId,
            size: fileItem.file ? fileItem.file.size : 0,
            width: null,
            height: null,
            isExisting: false,
            uniqueId: `new_${fileItem.filename}_${Date.now()}`
          };
        });
        
        allImages = [...updatedImages, ...newImageObjects];
        
        if (newImageObjects.length > 0) {
          const totalNewSize = newImageObjects.reduce((sum, img) => sum + (img.size || 0), 0);
          successMessage = `${newImageObjects.length}개 파일이 추가되었습니다! (${formatFileSize(totalNewSize)})`;
          setTimeout(() => successMessage = '', 3000);
        }
      }
      
    } catch (error) {
      console.error('동기화 오류:', error);
    }
  }

  function updateImageResolution(filename, width, height) {
    allImages = allImages.map(img => {
      if (img.name === filename) {
        return {
          ...img,
          width: width,
          height: height
        };
      }
      return img;
    });
  }

  // resetMemoryState 함수 추가
  function resetMemoryState() {
    console.log('🧹 메모리 상태 초기화 시작');
    
    // 모든 상태 변수 초기화
    newImages = [];
    existingImages = [];
    allImages = [];
    processedFiles.clear();
    
    // UI 상태 초기화
    errorMessage = '';
    successMessage = '';
    uploadProgress = 0;
    uploading = false;
    selectedImageIndex = null;
    
    // FilePond 초기화
    if (pond && typeof pond.removeFiles === 'function') {
      try {
        pond.removeFiles();
      } catch (error) {
        console.warn('FilePond 정리 실패:', error);
      }
    }
    
    console.log('✅ 메모리 상태 초기화 완료');
  }


  
  // 2. 간단한 handleImageAddClick 함수 (스크롤 문제 해결)
  function handleImageAddClick() {
    if (disabled || !isLibraryLoaded || allImages.length >= maxFiles) {
      return;
    }
    
    // 간단한 파일 입력 생성
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.multiple = maxFiles > 1;
    
    // 화면에서 완전히 숨김 (스크롤 문제 방지)
    fileInput.style.cssText = `
      position: fixed !important;
      left: -9999px !important;
      top: -9999px !important;
      width: 1px !important;
      height: 1px !important;
      opacity: 0 !important;
      pointer-events: none !important;
    `;
    
    // 파일 선택 처리
    // 파일 선택 처리
      const handleFileChange = async (event) => {
      const files = Array.from(event.target.files || []);
      
      if (files.length === 0) {
        cleanup();
        return;
      }
      
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      
      if (imageFiles.length === 0) {
        errorMessage = '이미지 파일만 업로드 가능합니다.';
        setTimeout(() => errorMessage = '', 3000);
        cleanup();
        return;
      }
      
      // ⬇️ 디버깅: 원본 파일 크기 확인
      console.log('=== 파일 크기 디버깅 ===');
      imageFiles.forEach((file, index) => {
        console.log(`파일 ${index + 1}: ${file.name} = ${formatFileSize(file.size)}`);
      });
      
      // 리사이즈 처리
      const resizedFiles = [];
      for (const file of imageFiles) {
        const resizedFile = await resizeImageSync(file);
        resizedFiles.push(resizedFile);
        
        // ⬇️ 디버깅: 리사이즈 후 크기
        console.log(`리사이즈: ${file.name}`, {
          원본: formatFileSize(file.size),
          리사이즈후: formatFileSize(resizedFile.size),
          압축률: Math.round((1 - resizedFile.size/file.size) * 100) + '%'
        });
      }
      
      // 기존 파일들 크기 계산
      const currentNewFilesSize = newImages.reduce((total, img) => {
        const processedFile = processedFiles.get(img.name);
        const fileSize = processedFile ? processedFile.size : (img.file?.size || 0);
        console.log(`기존 파일: ${img.name} = ${formatFileSize(fileSize)}`);
        return total + fileSize;
      }, 0);
      
      // 새 파일들 크기
      const newFilesSize = resizedFiles.reduce((total, file) => total + file.size, 0);
      
      const totalNewSize = currentNewFilesSize + newFilesSize;
      const maxTotalNewSize = 50 * 1024 * 1024;
      
      // ⬇️ 디버깅: 최종 계산
      console.log('=== 용량 계산 결과 ===');
      console.log('기존 새 파일들:', formatFileSize(currentNewFilesSize));
      console.log('추가할 파일들:', formatFileSize(newFilesSize));
      console.log('총 크기:', formatFileSize(totalNewSize));
      console.log('제한:', formatFileSize(maxTotalNewSize));
      console.log('초과 여부:', totalNewSize > maxTotalNewSize ? '❌ 초과' : '✅ 통과');
      
      if (totalNewSize > maxTotalNewSize) {
        errorMessage = `새 파일들의 총 크기가 ${formatFileSize(maxTotalNewSize)}를 초과합니다. 현재: ${formatFileSize(totalNewSize)}`;
        setTimeout(() => errorMessage = '', 5000);
        cleanup();
        return;
      }
      
      // FilePond에 파일 추가
      // FilePond에 파일 추가
      try {
        resizedFiles.forEach(file => {  // ← imageFiles 대신 resizedFiles 사용
          if (pond) {
            processedFiles.set(file.name, file);
            pond.addFile(file);
          }
        });
      } catch (error) {
        console.error('파일 추가 오류:', error);
        errorMessage = '파일 추가에 실패했습니다.';
        setTimeout(() => errorMessage = '', 3000);
      }
      
      cleanup();
    };
    
    // 정리 함수
    const cleanup = () => {
      try {
        if (fileInput.parentNode) {
          fileInput.parentNode.removeChild(fileInput);
        }
      } catch (error) {
        console.warn('Input 정리 실패:', error);
      }
    };
    
    // 이벤트 리스너 등록
    fileInput.addEventListener('change', handleFileChange, { once: true });
    
    // DOM에 추가하고 클릭 (스크롤 문제 방지를 위해 focus 제거)
    document.body.appendChild(fileInput);
    
    try {
      fileInput.click(); // focus() 제거로 스크롤 문제 해결
    } catch (error) {
      console.error('파일 선택창 열기 실패:', error);
      errorMessage = '파일 선택창을 열 수 없습니다.';
      setTimeout(() => errorMessage = '', 3000);
      cleanup();
    }
    
    // 안전장치: 10초 후 자동 정리
    setTimeout(cleanup, 10000);
  }

  // 추가적인 iOS Safari 호환성 개선을 위한 유틸리티 함수들

  // FilePond 상태 리셋 함수 (필요 시 사용)
  function resetFilePondState() {
    if (pond && typeof pond.setOptions === 'function') {
      try {
        console.log('🔄 FilePond 상태 리셋');
        pond.setOptions({
          allowMultiple: maxFiles > 1,
          maxFiles: maxFiles,
          allowBrowse: true,
          allowDrop: true
        });
      } catch (error) {
        console.warn('⚠️ FilePond 리셋 실패:', error);
      }
    }
  }

  // iOS Safari 감지 및 특별 처리
  const isIOSSafari = () => {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/.test(ua);
    return isIOS && isSafari;
  };

  // onMount에서 호출할 iOS Safari 초기화
  function initIOSSafariCompatibility() {
    if (isIOSSafari()) {
      console.log('🍎 iOS Safari 감지됨 - 특별 호환성 모드 활성화');
      
      // 터치 이벤트 최적화
      document.addEventListener('touchstart', function() {}, { passive: true });
      
      // FilePond가 준비되면 iOS Safari 설정 적용
      if (pond) {
        // iOS Safari에서 문제가 되는 설정들 조정
        pond.setOptions({
          dropOnPage: false, // iOS Safari에서 문제 방지
          dropValidation: true,
          allowReorder: false, // 터치 이벤트 충돌 방지
        });
      }
    }
  }

  // 추가적인 iOS Safari 호환성 개선
  // 컴포넌트 마운트 시 실행할 추가 설정
  function setupIOSCompatibility() {
    // iOS Safari 감지
    const isIOSSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && 
                        /Safari/.test(navigator.userAgent) && 
                        !/CriOS|FxiOS|OPiOS|mercury/.test(navigator.userAgent);
    
    if (isIOSSafari) {
      console.log('iOS Safari 감지됨 - 호환성 모드 활성화');
      
      // 전역 터치 이벤트 최적화
      document.addEventListener('touchstart', function() {}, { passive: true });
      
      // 파일 선택 버튼에 추가 속성 설정
      const addButton = document.querySelector('[data-add-button]');
      if (addButton) {
        addButton.style.cursor = 'pointer';
        addButton.style.webkitTouchCallout = 'none';
        addButton.style.webkitUserSelect = 'none';
      }
    }
  }

  // onMount에서 호출
  // onMount(() => {
  //   setupIOSCompatibility();
  //   // ... 기존 코드
  // });

  // 기존 함수를 대체하는 완전한 버전
  export function createIOSCompatibleFileInput(options = {}) {
    const {
      accept = 'image/*',
      multiple = true,
      onFileSelect,
      onError,
      maxFileSize = 10 * 1024 * 1024,
      maxTotalSize = 50 * 1024 * 1024
    } = options;
    
    return function triggerFileSelection() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.multiple = multiple;
      
      // 스타일 설정 (iOS 호환)
      Object.assign(input.style, {
        position: 'absolute',
        left: '-9999px',
        top: '-9999px',
        width: '1px',
        height: '1px',
        opacity: '0.01',
        zIndex: '-1'
      });
      
      const cleanup = () => {
        if (input.parentNode) {
          input.parentNode.removeChild(input);
        }
      };
      
      input.addEventListener('change', (event) => {
        const files = Array.from(event.target.files || []);
        if (files.length > 0 && onFileSelect) {
          onFileSelect(files);
        }
        cleanup();
      }, { once: true });
      
      input.addEventListener('cancel', cleanup, { once: true });
      
      document.body.appendChild(input);
      
      try {
        input.click();
      } catch (error) {
        if (onError) onError(error);
        cleanup();
      }
      
      // 안전장치
      setTimeout(cleanup, 10000);
    };
  }
  
  function handleImageClick(index) {
    if (Date.now() - lastDragEndTime < 300) {
      return;
    }
    
    selectedImageIndex = selectedImageIndex === index ? null : index;
  }
  
  function handleImageLoad(event, index) {
    const img = event.target;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    
    if (naturalWidth && naturalHeight && allImages[index]) {
      allImages[index] = {
        ...allImages[index],
        width: naturalWidth,
        height: naturalHeight
      };
      allImages = [...allImages];
    }
  }
  
  function removeImage(index) {
    const image = allImages[index];
    if (!image) return;
    
    if (!image.isExisting && pond) {
      try {
        const pondFiles = pond.getFiles();
        const pondFile = pondFiles.find(file => file.filename === image.name);
        if (pondFile) {
          pond.removeFile(pondFile);
        }
      } catch (error) {
        // 무시
      }
      
      if (image.url) {
        URL.revokeObjectURL(image.url);
      }
    }
    
    allImages = allImages.filter((_, i) => i !== index);
    selectedImageIndex = null;
  }
  
  function handleAddButtonDragEnter(event) {
    if (disabled || !isLibraryLoaded) return;
    if (!event.dataTransfer?.types?.includes('Files')) return;
    
    event.preventDefault();
    isFileDragOver = true;
  }
  
  function handleAddButtonDragOver(event) {
    if (disabled || !isLibraryLoaded) return;
    if (!event.dataTransfer?.types?.includes('Files')) return;
    
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }
  
  function handleAddButtonDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      isFileDragOver = false;
    }
  }
  
  function handleAddButtonDrop(event) {
    event.preventDefault();
    isFileDragOver = false;
    
    if (disabled || !isLibraryLoaded) return;
    
    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;
    
    const imageFiles = Array.from(files).filter(file => 
      file.type.startsWith('image/')
    );
    
    if (imageFiles.length === 0) {
      errorMessage = '이미지 파일만 업로드 가능합니다.';
      setTimeout(() => errorMessage = '', 3000);
      return;
    }
    
    try {
      imageFiles.forEach(file => {
        pond.addFile(file);
      });
    } catch (error) {
      errorMessage = '파일 추가에 실패했습니다.';
      setTimeout(() => errorMessage = '', 3000);
    }
  }
  
  function handleDragStart(event, index) {
    event.dataTransfer.setData('text/plain', index.toString());
    event.dataTransfer.effectAllowed = 'move';
    
    draggedIndex = index;
    isDragging = true;
    
    setTimeout(() => {
      const draggedElement = document.querySelector(`[data-image-index="${index}"]`);
      if (draggedElement) {
        draggedElement.style.opacity = '0.5';
      }
    }, 0);
  }
  
  function handleDragOver(event) {
    if (!isDragging) return;
    
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }
  
  function handleDrop(event, dropIndex) {
    event.preventDefault();
    
    if (!isDragging) return;
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      resetDragState();
      return;
    }
    
    reorderImages(draggedIndex, dropIndex);
    resetDragState();
  }
  
  function resetDragState() {
    document.querySelectorAll('[data-image-index]').forEach(el => {
      el.style.opacity = '';
    });
    
    isDragging = false;
    draggedIndex = null;
  }
  
  function reorderImages(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex >= allImages.length || toIndex >= allImages.length) {
      return;
    }
    
    const newAllImages = [...allImages];
    const [draggedItem] = newAllImages.splice(fromIndex, 1);
    newAllImages.splice(toIndex, 0, draggedItem);
    
    allImages = newAllImages;
  }
  
  //업로드 함수
  async function uploadToServer() {
    if (!isLibraryLoaded || !imagGub1 || !imagGub2 || !imagCode) {
      dispatch('error', { message: '필수 파라미터가 누락되었습니다.' });
      return;
    }
    
    if (allImages.length === 0) {
      dispatch('error', { message: '저장할 이미지가 없습니다.' });
      return;
    }
    
    // 새 파일들의 총 크기 체크
    const newImageFiles = allImages.filter(img => !img.isExisting && img.file);
    
    // ✅ 수정 (리사이즈된 파일 크기):
    const totalNewFileSize = newImageFiles.reduce((total, img) => {
      const processedFile = processedFiles.get(img.name);
      const fileSize = processedFile ? processedFile.size : (img.file?.size || 0);
      return total + fileSize;
    }, 0);
    const maxUploadSize = 50 * 1024 * 1024; // 50MB 제한 (전체)


    if (totalNewFileSize > maxUploadSize) {
      dispatch('error', { 
        message: `업로드할 파일 크기가 너무 큽니다. 새 파일들의 총 크기: ${formatFileSize(totalNewFileSize)} (제한: ${formatFileSize(maxUploadSize)})` 
      });
      return;
    }
    
    uploading = true;
    uploadProgress = 0;
    
    try {
      const formData = new FormData();
      formData.append('IMAG_GUB1', imagGub1);
      formData.append('IMAG_GUB2', imagGub2);
      formData.append('IMAG_CODE', imagCode);
      
      const finalOrder = allImages.map((img, index) => ({
        name: img.name,
        isExisting: img.isExisting,
        finalOrder: index + 1
      }));
      
      formData.append('finalOrder', JSON.stringify(finalOrder));
      console.log('최종 순서 전송:', finalOrder);
      
      // 새 파일들 추가 시 변환된 파일 사용
      const newFiles = allImages.filter(img => !img.isExisting && img.file);
      newFiles.forEach((img) => {
        // 변환된 파일이 있으면 그것을 사용, 없으면 원본 사용
        const fileToUpload = processedFiles.get(img.name) || img.file;
        if (fileToUpload) {
          formData.append('files', fileToUpload);
          console.log(`파일 추가: ${img.name} (크기: ${fileToUpload.size})`);
        }
      });
      
      console.log(`전송: 전체 ${allImages.length}개 (기존 ${allImages.filter(img => img.isExisting).length}개, 신규 ${newFiles.length}개)`);
      
      const response = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        successMessage = `이미지가 성공적으로 저장되었습니다!`;
        setTimeout(() => successMessage = '', 3000);

        // ✅ 부모 컴포넌트에 이벤트 전달 추가
        dispatch('imageSaved', { 
          imagCode: imagCode,
          files: result.files 
        });
        
        setTimeout(async () => {
          try {
            // ✅ 먼저 캐시 무효화
            if (typeof window !== 'undefined' && window.simpleCache) {
              await window.simpleCache.invalidateProductCache(imagCode);
              console.log('🗑️ 캐시 무효화 완료:', imagCode);
            }
            
            // FilePond 정리
            if (pond && pond.removeFiles) {
              pond.removeFiles();
            }
            processedFiles.clear();
            
            // 이미지 재조회
            await loadExistingImages();
          } catch (refreshError) {
            console.warn('새로고침 실패:', refreshError);
          }
        }, 100);
      
        
        // 모든 업로드 성공 후 불필요한 이미지 삭제
        //const savedImageCount = allImages.length;
        
        //if (savedImageCount > 0 && savedImageCount < 10) {
        //  await deleteUnnecessaryImages(savedImageCount);
       // }
      } else {
        throw new Error(result.error || '저장 실패');
      }
      
    } catch (error) {
      let errorMsg = '이미지 저장에 실패했습니다.';
      
      if (error.message.includes('413')) {
        errorMsg = `파일 크기가 너무 큽니다. 개별 파일은 10MB, 총 새 파일은 50MB 이하만 업로드 가능합니다.`;
      } else if (error.message.includes('422')) {
        errorMsg = '지원하지 않는 파일 형식입니다.';
      } else if (error.message.includes('PayloadTooLargeError')) {
        errorMsg = `서버 업로드 제한을 초과했습니다. 파일 크기를 줄여주세요.`;
      }
      
      errorMessage = errorMsg;
      setTimeout(() => errorMessage = '', 5000);
    } finally {
      uploading = false;
      uploadProgress = 0;
    }
  }

  // 불필요한 이미지 삭제 함수
  async function deleteUnnecessaryImages(keepCount) {
    if (!imagCode || keepCount >= 10) return;
    
    try {
      const response = await fetch('/api/images/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          product_code: imagCode,
          keep_count: keepCount
        })
      });
      
      const result = await response.json();
      console.log('불필요한 이미지 삭제 결과:', result);
      //clearImageCache(keepCount);
    } catch (error) {
      console.error('불필요한 이미지 삭제 오류:', error);
    }
  }

  // 모든 이미지 삭제 함수 (외부에서 호출 가능)
  export async function deleteAllImages() {
    if (!imagCode) {
      console.log('제품코드가 없어서 이미지 삭제를 건너뜀');
      return { success: true, message: '삭제할 제품코드가 없습니다.' };
    }
    
    try {
      console.log(`${imagCode} 제품의 모든 이미지 삭제 시작`);
      
      // 1-10번 모든 이미지 삭제 API 호출
      const response = await fetch('/api/images/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          product_code: imagCode,
          keep_count: 0  // 0개 유지 = 모든 이미지 삭제
        })
      });
      
      const result = await response.json();
      console.log('모든 이미지 삭제 결과:', result);
      
      // 모든 캐시도 클리어
      //clearAllImageCache();
      
      // UI도 초기화
      allImages = [];
      
      return result;
      
    } catch (error) {
      console.error('모든 이미지 삭제 오류:', error);
      return { 
        success: false, 
        message: '이미지 삭제 중 오류가 발생했습니다: ' + error.message 
      };
    }
  }

  
  function clearAll() {
    if (pond && pond.removeFiles) {
      pond.removeFiles();
    }
    
    allImages.forEach(img => {
      if (!img.isExisting && img.url) {
        URL.revokeObjectURL(img.url);
      }
    });
    
    allImages = [];
    selectedImageIndex = null;
  }
  
  function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
  
  function destroy() {
    if (pond && typeof pond.destroy === 'function') {
      pond.destroy();
      pond = null;
    }
    isLibraryLoaded = false;
  }
  
  export { clearAll, destroy, toggleResize, uploadToServer, loadExistingImages, resetMemoryState };
  
  export function forceReload(newImagGub1, newImagGub2, newImagCode) {
    console.log('강제 리로드 시작');
    
    isLoadingImages = false;
    lastLoadedKey = '';
    
    allImages.forEach(img => {
      if (!img.isExisting && img.url && img.url.startsWith('blob:')) {
        URL.revokeObjectURL(img.url);
      }
    });
    
    allImages = [];
    resetTouchDragState();
    selectedImageIndex = null;
    errorMessage = '';
    successMessage = '';
    
    if (pond && typeof pond.removeFiles === 'function') {
      try {
        pond.removeFiles();
      } catch (error) {
        console.warn('FilePond 정리 실패:', error);
      }
    }
    
    if (newImagGub1) imagGub1 = newImagGub1;
    if (newImagGub2) imagGub2 = newImagGub2;
    if (newImagCode) imagCode = newImagCode;
    
    if (imagGub1 && imagGub2 && imagCode) {
      setTimeout(() => {
        loadExistingImages();
      }, 200);
    }
  }
  
  $: if (browser && isLibraryLoaded && imagGub1 && imagGub2 && imagCode) {
    const currentKey = `${imagGub1}-${imagGub2}-${imagCode}`;
    
    if (currentKey !== lastLoadedKey && !isLoadingImages) {
      loadExistingImages();
    }
  }
  
  $: dispatch('images-updated', { 
    images: allImages, 
    existingCount: existingImages.length, 
    newCount: newImages.length 
  });
</script>

<div class="w-full md:w-auto md:min-w-96 bg-white rounded-xl shadow-lg overflow-hidden transition-opacity duration-300" 
     class:opacity-60={disabled}>
  
  <!-- 성공 메시지 -->
  {#if successMessage}
    <div class="p-4 bg-green-50 border-l-4 border-green-400">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm text-green-700">{successMessage}</p>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- 에러 메시지 -->
  {#if errorMessage}
    <div class="p-4 bg-red-50 border-l-4 border-red-400">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm text-red-700">{errorMessage}</p>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- 초기화 오류 표시 -->
  {#if initializationError}
    <div class="p-4 bg-red-50 border-l-4 border-red-400">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm text-red-700">
            <strong>초기화 오류:</strong> {initializationError}
          </p>
          <button 
            class="mt-2 text-sm text-red-600 underline hover:text-red-800"
            on:click={() => window.location.reload()}
          >
            페이지 새로고침
          </button>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- 로딩 상태 표시 -->
  {#if !isLibraryLoaded && !initializationError}
    <div class="p-4 bg-blue-50 border-l-4 border-blue-400">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <div class="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div class="ml-3">
          <p class="text-sm text-blue-700">FilePond 라이브러리를 로드하고 있습니다...</p>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- 컨트롤 패널 -->
  <div class="flex flex-wrap justify-between items-center px-3 py-2 bg-gray-50 border-b border-gray-200 gap-2 text-xs">
    <div class="flex items-center gap-3">
      <!-- 리사이즈 토글 -->
      <label class="flex items-center gap-2 cursor-pointer select-none">
        <div class="relative">
          <input 
            type="checkbox" 
            bind:checked={enableResize}
            on:change={toggleResize}
            disabled={disabled}
            class="sr-only"
          />
          <div class="w-10 h-5 rounded-full transition-colors duration-300 cursor-pointer border-2" 
              class:bg-blue-500={enableResize}
              class:border-blue-500={enableResize}
              class:bg-gray-200={!enableResize}
              class:border-gray-300={!enableResize}
              on:click={() => !disabled && toggleResize()}>
            <div class="w-3 h-3 bg-white rounded-full absolute top-0.5 transition-transform duration-300 transform shadow-sm" 
                class:translate-x-5={enableResize} 
                class:translate-x-0.5={!enableResize}></div>
          </div>
        </div>
        <span class="text-xs font-medium transition-colors duration-200"
              class:text-blue-600={enableResize}
              class:text-gray-500={!enableResize}>
          리사이즈 {enableResize ? 'ON' : 'OFF'}
        </span>
      </label>

      <!-- 옵션 버튼 추가 -->
      {#if enableResize}
        <button
          class="px-2 py-1 text-xs rounded border transition-all duration-200"
          class:bg-blue-500={showResizeOptions}
          class:text-white={showResizeOptions}
          class:border-blue-500={showResizeOptions}
          class:bg-white={!showResizeOptions}
          class:text-gray-700={!showResizeOptions}
          class:border-gray-300={!showResizeOptions}
          class:hover:bg-blue-50={!showResizeOptions}
          on:click={toggleResizeOptions}
          type="button"
        >
          옵션 {showResizeOptions ? '▲' : '▼'}
        </button>
      {/if}
    </div>
    
    <div class="flex items-center gap-2">
      <!-- 파일 개수 및 상태 표시 -->
      {#if allImages.length > 0}
        <span class="text-xs font-semibold text-blue-600 px-1.5 py-0.5 bg-blue-50 rounded">
          총 {allImages.length}/{maxFiles}
        </span>
      {/if}
      
      <!-- 기존/새 이미지 개수 표시 -->
      {#if existingImages.length > 0 || newImages.length > 0}
        <span class="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
          기존 {existingImages.length} | 새 {newImages.length}
          {#if newImages.length > 0}
            ({formatFileSize(newImages.reduce((sum, img) => sum + (img.size || 0), 0))})
          {/if}
        </span>
      {/if}
      
      <!-- 선택된 이미지 정보 -->
      {#if selectedImageIndex !== null}
        <span class="text-xs text-purple-600 px-2 py-1 bg-purple-50 rounded">
          {#if allImages[selectedImageIndex]?.isExisting}
            기존 이미지 선택
          {:else}
            새 이미지 선택
          {/if}
        </span>
      {/if}
      
      <!-- 업로드 진행률 -->
      {#if uploading}
        <div class="flex items-center gap-1">
          <div class="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div class="h-full bg-blue-500 transition-all duration-300" style="width: {uploadProgress}%"></div>
          </div>
          <span class="text-xs text-gray-500">{uploadProgress}%</span>
        </div>
      {/if}
      
      <!-- 저장 버튼 -->
      {#if allImages.length > 0 && !uploading && isLibraryLoaded}
        <button 
          class="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors duration-200 disabled:opacity-50 cursor-pointer"
          on:click={uploadToServer}
          disabled={disabled || !imagGub1 || !imagGub2 || !imagCode}
        >
          저장
        </button>
      {/if}
      
      <!-- 모두 제거 버튼 -->
      {#if allImages.length > 0 && isLibraryLoaded}
        <button 
          class="px-1.5 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors duration-200 disabled:opacity-50 cursor-pointer"
          on:click={clearAll}
          disabled={disabled}
          type="button"
        >
          초기화
        </button>
      {/if}
    </div>
  </div>
  
  <!-- 리사이즈 설정 패널 -->
  {#if enableResize && isLibraryLoaded && showResizeOptions}
    <div class="px-4 py-3 bg-blue-50 border-b border-blue-200">
      <div class="space-y-3">
        <!-- 리사이즈 모드 선택 -->
        <div class="flex items-center gap-4">
          <span class="text-sm font-medium text-gray-700">모드:</span>
          <label class="flex items-center gap-2 cursor-pointer">
            <input 
              type="radio" 
              bind:group={resizeMode} 
              value="contain"
              on:change={() => changeResizeMode('contain')}
              class="w-4 h-4 text-blue-600"
            />
            <span class="text-sm">축소 (전체보존)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input 
              type="radio" 
              bind:group={resizeMode} 
              value="cover"
              on:change={() => changeResizeMode('cover')}
              class="w-4 h-4 text-blue-600"
            />
            <span class="text-sm">자르기 (정확한크기)</span>
          </label>
        </div>
        
        <!-- 크기 선택 버튼들 -->
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm font-medium text-gray-700">크기:</span>
          
          {#each quickSizes as size}
            <button
              class="px-2 py-0.5 text-sm rounded border transition-colors"
              class:bg-blue-500={selectedWidth === size.width && selectedHeight === size.height}
              class:text-white={selectedWidth === size.width && selectedHeight === size.height}
              class:border-blue-500={selectedWidth === size.width && selectedHeight === size.height}
              class:bg-white={selectedWidth !== size.width || selectedHeight !== size.height}
              class:text-gray-700={selectedWidth !== size.width || selectedHeight !== size.height}
              class:border-gray-300={selectedWidth !== size.width || selectedHeight !== size.height}
              on:click={() => selectQuickSize(size)}
            >
              {size.label}
            </button>
          {/each}
          
          <button
            class="px-2 py-0.5 text-sm rounded border transition-colors"
            class:bg-purple-500={showCustomSize}
            class:text-white={showCustomSize}
            class:border-purple-500={showCustomSize}
            class:bg-white={!showCustomSize}
            class:text-gray-700={!showCustomSize}
            class:border-gray-300={!showCustomSize}
            on:click={() => showCustomSize = !showCustomSize}
          >
            사용자 정의
          </button>
        </div>
        
        <!-- 사용자 정의 입력 -->
        {#if showCustomSize}
          <div class="flex items-center gap-2 p-3 bg-white rounded border border-purple-200">
            <span class="text-sm text-gray-600">크기:</span>
            <input
              type="number"
              bind:value={customWidth}
              min="50"
              max="2000"
              class="w-20 px-1 py-0.5 text-sm border border-gray-300 rounded"
            />
            <span class="text-sm text-gray-500">×</span>
            <input
              type="number"
              bind:value={customHeight}
              min="50"
              max="2000"
              class="w-20 px-1 py-0.5 text-sm border border-gray-300 rounded"
            />
            <span class="text-sm text-gray-500">px</span>
            <button
              class="px-1 py-0.5 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
              on:click={applyCustomSize}
            >
              적용
            </button>
            <button
              class="px-1 py-0.5 text-sm bg-gray-400 text-white rounded hover:bg-gray-500"
              on:click={() => showCustomSize = false}
            >
              취소
            </button>
          </div>
        {/if}
        
        <!-- 현재 설정 표시 -->
        <div class="flex items-center justify-between text-xs text-gray-600">
          <span>
            현재 설정: <strong>{selectedWidth}×{selectedHeight}</strong> 
            ({resizeMode === 'contain' ? '축소모드' : '자르기모드'})
          </span>
          <span class="text-blue-600">품질: {Math.round(quality * 100)}%</span>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- 이미지 표시 영역 -->
  <div class="p-6">
    <div class="mb-6">
      <h3 class="text-sm font-medium text-gray-700 mb-3">
        이미지 관리 ({allImages.length}개)
        {#if existingImages.length > 0 || newImages.length > 0}
          <span class="text-xs text-gray-500 ml-2">기존 {existingImages.length}개 + 새 {newImages.length}개</span>
        {/if}
      </h3>
      
      <!-- 이미지 그리드 + 추가 버튼 -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        
        <!-- 통합 이미지 리스트 -->
        {#each allImages as image, index}
          <div 
            class="relative group bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer touch-manipulation"
            class:ring-2={selectedImageIndex === index}
            class:ring-blue-500={selectedImageIndex === index && image.isExisting}
            class:ring-green-500={selectedImageIndex === index && !image.isExisting}
            data-image-index={index}
            draggable="true"
            on:dragstart={(e) => handleDragStart(e, index)}
            on:dragover={handleDragOver}
            on:drop={(e) => handleDrop(e, index)}
            on:touchstart={(e) => handleTouchStart(e, index)}
            on:touchmove={(e) => handleTouchMove(e)}
            on:touchend={(e) => handleTouchEnd(e)}
            on:click={() => handleImageClick(index)}
            style="touch-action: manipulation; -webkit-user-select: none; user-select: none;"
          >
            <!-- 이미지 -->
            <div class="aspect-square">
              <img 
                src={image.url}
                alt={image.name}
                class="w-full h-full object-cover"
                loading="lazy"
                on:error={(e) => {
                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMiA4VjE2TTggMTJIMTYiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPHRLEDU+PC90ZXh0Pgo8L3N2Zz4=';
                  e.target.classList.add('opacity-50');
                }}
                on:load={(e) => handleImageLoad(e, index)}
              />
            </div>
            
            <!-- X 버튼 - 선택된 이미지에만 표시 -->
            {#if selectedImageIndex === index}
              <button 
                class="absolute top-2 right-2 w-7 h-7 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg z-10"
                class:bg-red-500={image.isExisting}
                class:bg-orange-500={!image.isExisting}
                on:click|stopPropagation={() => removeImage(index)}
                disabled={disabled}
                type="button"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            {/if}
            
            <!-- 상태 아이콘 + 순서 번호 -->
            <div class="absolute top-2 left-2 flex items-center gap-1">
              {#if image.isExisting}
                <div class="w-6 h-6 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-bold shadow-lg">
                  {index + 1}
                </div>
              {:else}
                <div class="px-2 py-1 bg-green-500 text-white text-xs rounded-full font-bold shadow-lg flex items-center gap-1">
                  <span class="text-xs">{index + 1}</span>
                  <span>NEW</span>
                </div>
              {/if}
            </div>
            
            <!-- 드래그 안내 (모바일) -->
            <div class="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div class="bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                길게 누르고 드래그
              </div>
            </div>
            
            <!-- 파일 정보 -->
            <div class="p-2 bg-white">
              <p class="text-xs text-gray-600 truncate font-medium" title={image.name}>{image.name}</p>
              <div class="flex items-center justify-between mt-1">
                <div class="flex items-center gap-2 text-xs text-gray-400">
                  {#if image.size}
                    <span>{formatFileSize(image.size)}</span>
                  {/if}
                  {#if image.width && image.height}
                    <span class="text-gray-500">•</span>
                    <span class="font-mono font-medium" class:text-blue-600={image.isExisting} class:text-green-600={!image.isExisting}>
                      {image.width}×{image.height}
                    </span>
                  {:else if image.isExisting}
                    <span class="text-gray-500">•</span>
                    <span class="text-gray-400 text-xs">해상도 로딩중...</span>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {/each}
        
        <!-- 이미지 추가 버튼 - 드래그 앤 드롭 전용 -->
        {#if allImages.length < maxFiles}
          <div class="relative">
            <div 
              class="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-200"
              class:border-gray-300={!disabled && isLibraryLoaded}
              class:bg-gray-50={!disabled && isLibraryLoaded}
              class:hover:border-blue-400={!disabled && isLibraryLoaded && !isFileDragOver}
              class:hover:bg-blue-50={!disabled && isLibraryLoaded && !isFileDragOver}
              class:border-blue-400={isFileDragOver}
              class:bg-blue-50={isFileDragOver}
              class:border-red-300={disabled || !isLibraryLoaded}
              class:bg-red-50={disabled || !isLibraryLoaded}
              class:opacity-50={disabled || !isLibraryLoaded}
              on:click={handleImageAddClick}
              on:dragenter={handleAddButtonDragEnter}
              on:dragover={handleAddButtonDragOver}
              on:dragleave={handleAddButtonDragLeave}
              on:drop={handleAddButtonDrop}
            >
              {#if isFileDragOver}
                <div class="text-4xl text-blue-500 mb-2">📁</div>
                <p class="text-sm font-bold text-blue-700">드롭하세요</p>
                <p class="text-xs text-blue-600">이미지 파일</p>
              {:else}
                <div class="text-3xl mb-2" 
                     class:text-gray-400={!disabled && isLibraryLoaded}
                     class:text-red-400={disabled || !isLibraryLoaded}>+</div>
                <div class="text-xs text-center px-2"
                     class:text-gray-500={!disabled && isLibraryLoaded}
                     class:text-red-500={disabled || !isLibraryLoaded}>
                  {#if disabled}
                    비활성화됨
                  {:else if !isLibraryLoaded}
                    라이브러리 로딩중...
                  {:else}
                    이미지 추가<br/>
                    <span class="text-xs">({allImages.length}/{maxFiles})</span><br/>
                    <span class="text-xs text-blue-500">드래그 가능</span><br/>
                    <span class="text-xs text-gray-400">개별 10MB, 총 50MB</span>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
      
      <!-- 숨겨진 FilePond 입력 -->
      <div style="position: absolute; left: -9999px; opacity: 0; pointer-events: none;">
        <input 
          bind:this={pondElement}
          type="file" 
          multiple={maxFiles > 1}
          accept="image/*"
          disabled={disabled || !isLibraryLoaded}
        />
      </div>
      
      {#if newImages.length > 0}
        <p class="text-xs text-green-600 mt-3">
          {newImages.length}개 새 이미지가 추가되었습니다. ({formatFileSize(newImages.reduce((sum, img) => sum + (img.size || 0), 0))}) 저장 버튼을 클릭하여 저장하세요.
        </p>
      {/if}
      
      <!-- 안내 문구 -->
      {#if allImages.length > 1}
        <p class="text-xs text-gray-500 mt-2">
          <strong>PC:</strong> 이미지를 드래그하여 순서를 변경할 수 있습니다<br/>
          <strong>모바일:</strong> 이미지를 길게 누른 후 드래그하여 순서를 변경할 수 있습니다
        </p>
      {/if}
      
      {#if allImages.length < maxFiles}
        <p class="text-xs text-blue-500 mt-1">
          "+" 버튼에 파일을 드래그 앤 드롭하여 추가할 수 있습니다 (개별 10MB, 총 50MB 제한)
        </p>
      {/if}
    </div>
  </div>
</div>

<style>
  .touch-manipulation {
    touch-action: manipulation;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
</style>