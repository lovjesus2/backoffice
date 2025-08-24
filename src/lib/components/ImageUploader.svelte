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
  
  // 통합 이미지 배열
  let allImages = [];  
  let selectedImageIndex = null;
  
  // 드래그 상태
  let draggedIndex = null;
  let isDragging = false;
  let touchStartY = 0;
  let touchStartX = 0;
  
  // 파일 드래그 상태 (+ 버튼 전용)
  let isFileDragOver = false;
  
  // 로딩 상태
  let isLoadingImages = false;
  let lastLoadedKey = '';
  
  const dispatch = createEventDispatcher();
  
  // 기존/새 이미지 분리된 뷰
  $: existingImages = allImages.filter(img => img.isExisting);
  $: newImages = allImages.filter(img => !img.isExisting);
  $: images = allImages;
  
  onMount(async () => {
    if (!browser) return;
    
    try {
      initializationError = null;
      await initializeFilePond();
    } catch (error) {
      initializationError = error.message;
      dispatch('error', { message: 'FilePond 초기화에 실패했습니다.' });
    }
  });
  
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
      maxFileSize: '10MB', // 100MB → 10MB로 변경
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
      
      imageResizeTargetWidth: enableResize ? defaultWidth : null,
      imageResizeTargetHeight: enableResize ? defaultHeight : null,
      imageResizeMode: 'cover',
      imageResizeUpscale: false,
      
      imageTransformOutputMimeType: 'image/jpeg',
      imageTransformOutputQuality: quality,
      imageTransformOutputStrip: true,
      imageTransformClientTransforms: enableResize ? ['resize', 'transform'] : ['transform'],
      
      instantUpload: false,
      credits: false,
      server: null,
      
      onaddfile: (error, file) => {
        if (error) return;
        syncNewImagesFromPond();
      },
      onremovefile: (error, file) => {
        if (error) return;
        syncNewImagesFromPond();
      },
      onerror: (error) => {
        errorMessage = error.body || error.main || '알 수 없는 오류가 발생했습니다.';
        setTimeout(() => errorMessage = '', 5000);
      }
    });
    
    isLibraryLoaded = true;
    
    if (imagGub1 && imagGub2 && imagCode) {
      await loadExistingImages();
    }
  }
  
  async function loadExistingImages() {
    const currentKey = `${imagGub1}-${imagGub2}-${imagCode}`;
    
    if (!imagGub1 || !imagGub2 || !imagCode) {
      allImages = [];
      return;
    }
    
    if (isLoadingImages) return;
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
          url: img.name.startsWith('/') ? img.name : `/proxy-images/${img.name}`,
          isExisting: true,
          originalIndex: index,
          loadTime: Date.now(),
          width: null,
          height: null,
          uniqueId: `existing_${index}_${Date.now()}`
        }));
        
        allImages = [...loadedImages, ...newImages];
        lastLoadedKey = currentKey;
        preloadImageResolutions();
      } else {
        allImages = [...newImages];
        lastLoadedKey = currentKey;
      }
      
    } catch (error) {
      dispatch('error', { message: '기존 이미지 로드에 실패했습니다.' });
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
        imgElement.src = img.url;
      }
    });
  }
  
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
        let updatedImages = allImages.filter(img => 
          img.isExisting || !removedFileNames.includes(img.name)
        );
        
        const newImageObjects = newFiles.map((fileItem) => {
          let url = null;
          
          if (fileItem.file && (fileItem.file instanceof File || fileItem.file instanceof Blob)) {
            try {
              url = URL.createObjectURL(fileItem.file);
              
              const img = new Image();
              img.onload = function() {
                updateImageResolution(fileItem.filename, img.naturalWidth, img.naturalHeight);
              };
              img.src = url;
            } catch (urlError) {
              url = null;
            }
          }
          
          return {
            name: fileItem.filename,
            file: fileItem.file,
            url: url,
            serverId: fileItem.serverId,
            size: fileItem.file ? fileItem.file.size : 0, // 실제 파일 크기 사용
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
      console.warn('FilePond 동기화 오류:', error);
    }
  }
  
  function updateImageResolution(filename, width, height) {
    const index = allImages.findIndex(img => img.name === filename);
    if (index !== -1) {
      allImages[index] = {
        ...allImages[index],
        width: width,
        height: height
      };
      allImages = [...allImages];
    }
  }
  
  function handleImageAddClick() {
    if (disabled || !isLibraryLoaded || allImages.length >= maxFiles) {
      return;
    }
    
    // FilePond browse() 대신 네이티브 input 클릭 사용
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.multiple = maxFiles > 1;
    
    fileInput.onchange = (event) => {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;
      
      // 파일 검증
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      
      if (imageFiles.length === 0) {
        errorMessage = '이미지 파일만 업로드 가능합니다.';
        setTimeout(() => errorMessage = '', 3000);
        return;
      }
      
      if (allImages.length + imageFiles.length > maxFiles) {
        errorMessage = `최대 ${maxFiles}개의 파일만 업로드 가능합니다.`;
        setTimeout(() => errorMessage = '', 3000);
        return;
      }
      
      // 개별 파일 크기 체크
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      const oversizedFiles = imageFiles.filter(file => file.size > maxFileSize);
      
      if (oversizedFiles.length > 0) {
        errorMessage = `다음 파일이 10MB를 초과합니다: ${oversizedFiles.map(f => f.name).join(', ')}`;
        setTimeout(() => errorMessage = '', 5000);
        return;
      }
      
      // 전체 용량 체크
      const currentNewFilesSize = newImages.reduce((total, img) => total + (img.size || 0), 0);
      const newFilesSize = imageFiles.reduce((total, file) => total + file.size, 0);
      const totalNewSize = currentNewFilesSize + newFilesSize;
      const maxTotalNewSize = 50 * 1024 * 1024; // 50MB
      
      if (totalNewSize > maxTotalNewSize) {
        errorMessage = `새 파일들의 총 크기가 ${formatFileSize(maxTotalNewSize)}를 초과합니다. 현재: ${formatFileSize(totalNewSize)}`;
        setTimeout(() => errorMessage = '', 5000);
        return;
      }
      
      // FilePond에 파일 추가
      try {
        imageFiles.forEach(file => {
          console.log(`버튼으로 파일 추가: ${file.name} (${formatFileSize(file.size)})`);
          if (pond) {
            pond.addFile(file);
          }
        });
        console.log(`총 ${imageFiles.length}개 파일 추가 완료. 새 파일 총 용량: ${formatFileSize(totalNewSize)}`);
      } catch (error) {
        errorMessage = '파일 추가에 실패했습니다.';
        setTimeout(() => errorMessage = '', 3000);
        console.error('파일 추가 오류:', error);
      }
    };
    
    // 프로그래밍 방식으로 파일 선택 창 열기
    fileInput.click();
  }
  
  function handleImageClick(index) {
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
  
  // 파일 드래그 (+ 버튼에서만)
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
    
    if (allImages.length + imageFiles.length > maxFiles) {
      errorMessage = `최대 ${maxFiles}개의 파일만 업로드 가능합니다.`;
      setTimeout(() => errorMessage = '', 3000);
      return;
    }
    
    // 개별 파일 크기 체크 (10MB = 10 * 1024 * 1024 bytes)
    const maxFileSize = 10 * 1024 * 1024; // 100MB → 10MB로 변경
    const oversizedFiles = imageFiles.filter(file => file.size > maxFileSize);
    
    if (oversizedFiles.length > 0) {
      errorMessage = `다음 파일이 10MB를 초과합니다: ${oversizedFiles.map(f => f.name).join(', ')}`;
      setTimeout(() => errorMessage = '', 5000);
      return;
    }
    
    // 전체 용량 체크 수정 (기존 이미지는 제외하고 새 이미지만 계산)
    const currentNewFilesSize = newImages.reduce((total, img) => total + (img.size || 0), 0);
    const newFilesSize = imageFiles.reduce((total, file) => total + file.size, 0);
    const totalNewSize = currentNewFilesSize + newFilesSize; // 새 파일들만의 총 크기
    const maxTotalNewSize = 50 * 1024 * 1024; // 새 파일들 총 제한을 50MB로 변경
    
    if (totalNewSize > maxTotalNewSize) {
      errorMessage = `새 파일들의 총 크기가 ${formatFileSize(maxTotalNewSize)}를 초과합니다. 현재: ${formatFileSize(totalNewSize)}`;
      setTimeout(() => errorMessage = '', 5000);
      return;
    }
    
    try {
      imageFiles.forEach(file => {
        console.log(`파일 추가: ${file.name} (${formatFileSize(file.size)})`);
        pond.addFile(file);
      });
      console.log(`총 ${imageFiles.length}개 파일 추가 완료. 새 파일 총 용량: ${formatFileSize(totalNewSize)}`);
    } catch (error) {
      errorMessage = '파일 추가에 실패했습니다.';
      setTimeout(() => errorMessage = '', 3000);
    }
  }
  
  // 이미지 순서 변경
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
  
  // 터치 기반 순서 변경
  function handleTouchStart(event, index) {
    if (event.target.closest('button')) return;
    
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    draggedIndex = index;
    isDragging = false;
  }
  
  function handleTouchMove(event) {
    if (draggedIndex === null) return;
    
    const touch = event.touches[0];
    const deltaY = Math.abs(touch.clientY - touchStartY);
    const deltaX = Math.abs(touch.clientX - touchStartX);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (!isDragging && distance > 10) {
      isDragging = true;
      const element = document.querySelector(`[data-image-index="${draggedIndex}"]`);
      if (element) {
        element.style.opacity = '0.7';
      }
    }
    
    if (isDragging) {
      event.preventDefault();
    }
  }
  
  function handleTouchEnd(event) {
    if (draggedIndex === null) return;
    
    let dropIndex = null;
    
    if (isDragging) {
      const touch = event.changedTouches[0];
      dropIndex = getDropTargetIndex(touch.clientX, touch.clientY);
    }
    
    document.querySelectorAll('[data-image-index]').forEach(el => {
      el.style.opacity = '';
    });
    
    if (isDragging && dropIndex !== null && draggedIndex !== dropIndex) {
      reorderImages(draggedIndex, dropIndex);
    }
    
    isDragging = false;
    draggedIndex = null;
  }
  
  function getDropTargetIndex(x, y) {
    const elements = document.querySelectorAll('[data-image-index]');
    let closestIndex = null;
    let closestDistance = Infinity;
    
    elements.forEach(el => {
      const index = parseInt(el.getAttribute('data-image-index'));
      if (index === draggedIndex) return;
      
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const distance = Math.sqrt(
        Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)
      );
      
      if (x >= rect.left && x <= rect.right && 
          y >= rect.top && y <= rect.bottom && 
          distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    
    return closestIndex;
  }
  
  // uploadToServer 함수 수정 - 단순하게
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
    const totalNewFileSize = newImageFiles.reduce((total, img) => total + (img.file?.size || 0), 0);
    const maxUploadSize = 50 * 1024 * 1024; // 50MB 제한
    
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
      
      // ✅ 핵심: 최종 순서 정보 (allImages 그대로)
      const finalOrder = allImages.map((img, index) => ({
        name: img.name,
        isExisting: img.isExisting,
        finalOrder: index + 1
      }));
      
      formData.append('finalOrder', JSON.stringify(finalOrder));
      console.log('📋 최종 순서 전송:', finalOrder);
      
      // ✅ 새 파일들만 files로 전송 (순서 유지됨)
      const newFiles = allImages.filter(img => !img.isExisting && img.file);
      newFiles.forEach((img) => {
        if (img.file) {
          formData.append('files', img.file);
          console.log(`📁 새 파일 추가: ${img.name}`);
        }
      });
      
      console.log(`📤 전송: 전체 ${allImages.length}개 (기존 ${allImages.filter(img => img.isExisting).length}개, 신규 ${newFiles.length}개)`);
      
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
        
        // ✅ 저장 완료 후 새로고침 (캐시 방지)
        setTimeout(async () => {
          try {
            if (pond && pond.removeFiles) {
              pond.removeFiles();
            }
            // 캐시 방지를 위한 강제 새로고침
            await loadExistingImages();
          } catch (refreshError) {
            console.warn('새로고침 실패:', refreshError);
          }
        }, 1000);
        
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
  
  function toggleResize() {
    enableResize = !enableResize;
    
    if (pond && typeof pond.setOptions === 'function') {
      try {
        if (enableResize) {
          pond.setOptions({
            imageResizeTargetWidth: defaultWidth,
            imageResizeTargetHeight: defaultHeight,
            imageResizeMode: 'cover',
            imageTransformClientTransforms: ['resize', 'transform']
          });
        } else {
          pond.setOptions({
            imageResizeTargetWidth: null,
            imageResizeTargetHeight: null,
            imageTransformClientTransforms: ['transform']
          });
        }
      } catch (error) {
        // 무시
      }
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
  
  export { clearAll, destroy, toggleResize, uploadToServer, loadExistingImages };
  
  export function forceReload(newImagGub1, newImagGub2, newImagCode) {
    isLoadingImages = false;
    lastLoadedKey = '';
    
    allImages.forEach(img => {
      if (!img.isExisting && img.url) {
        URL.revokeObjectURL(img.url);
      }
    });
    
    allImages = [];
    draggedIndex = null;
    isDragging = false;
    selectedImageIndex = null;
    
    if (pond && typeof pond.removeFiles === 'function') {
      try {
        pond.removeFiles();
      } catch (error) {
        // 무시
      }
    }
    
    if (newImagGub1) imagGub1 = newImagGub1;
    if (newImagGub2) imagGub2 = newImagGub2;
    if (newImagCode) imagCode = newImagCode;
    
    if (imagGub1 && imagGub2 && imagCode) {
      setTimeout(() => {
        loadExistingImages();
      }, 100);
    }
  }
  
  // 반응형 구문
  $: if (browser && isLibraryLoaded && imagGub1 && imagGub2 && imagCode) {
    const currentKey = `${imagGub1}-${imagGub2}-${imagCode}`;
    
    if (!isLoadingImages && currentKey !== lastLoadedKey) {
      loadExistingImages();
    }
  }
  
  // 외부 images 업데이트
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
            class="relative group bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer"
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
          >
            <!-- 이미지 -->
            <div class="aspect-square">
              <img 
                src={image.url}
                alt={image.name}
                class="w-full h-full object-cover"
                loading="lazy"
                on:error={(e) => {
                  e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMiA4VjE2TTggMTJIMTYiIHN0cm9rZT0iIzlDQTNBRiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KPFRLEDU+PC90ZXh0Pgo8L3N2Zz4=';
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
          이미지를 드래그하여 순서를 변경할 수 있습니다
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
  [data-image-index] {
    touch-action: manipulation;
    -webkit-user-select: none;
    user-select: none;
    position: relative;
  }
  
  [data-image-index]:active {
    transform: scale(0.98);
    transition: transform 0.1s ease;
  }
</style>