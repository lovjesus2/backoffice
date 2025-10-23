<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  let user = null;  // ← 이 한 줄만 추가!
  

  let stats = {
    users: 0,
    posts: 0,
    views: 0,
    revenue: 0
  };

  let isMobile = false;
  let notes = [];
  let notesReady = false;
  let selectedNote = null;
  let offset = { x: 0, y: 0 };
  let isDragging = false;
  let isResizing = false;
  let resizeNote = null;
  let resizeStartSize = { width: 0, height: 0 };
  let resizeStartPos = { x: 0, y: 0 };
  let containerWidth = 0;
  let containerHeight = 0;

  const colors = [
    { id: 'color-purple', colorHeader: '#FED0FD', colorBody: '#FEE5FD', colorText: '#18181A' },
    { id: 'color-green', colorHeader: '#9EFFA2', colorBody: '#D7FFD9', colorText: '#18181A' },
    { id: 'color-yellow', colorHeader: '#F9ED69', colorBody: '#F7FD04', colorText: '#080808' },
    { id: 'color-blue', colorHeader: '#00D4FE', colorBody: '#CCFFFE', colorText: '#18181A' }
  ];

  onMount(async () => {

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    stats = {
      users: 1247,
      posts: 89,
      views: 12543,
      revenue: 15690
    };

    await loadNotes();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('resize', checkScreenSize);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    
  });


  function checkScreenSize() {
    if (browser) {
      isMobile = window.innerWidth <= 768;
      containerWidth = window.innerWidth;
      containerHeight = window.innerHeight;
    }
  }


  async function loadNotes() {
    notesReady = false;
    
    try {
      const response = await fetch('/api/notes');
      if (response.ok) {
        const data = await response.json();  // ← 이 줄 수정
        
        // 🎯 user 정보는 한 번만 받아서 저장 (추가)
        if (data.user && !user) {
          user = data.user;
          console.log('✅ 사용자 정보:', user.username, user.id);
        }
        
        notes = data.notes || data;  // ← 이 줄 수정 (기존 notes = await response.json();)
        
        // 실제 컨테이너 크기 확인
        const actualContainer = document.querySelector('.relative.overflow-auto');
        const safeWidth = actualContainer?.clientWidth || containerWidth || window.innerWidth || 390;
        const safeHeight = actualContainer?.clientHeight || containerHeight || window.innerHeight || 844;
        
        console.log('🔍 실제 컨테이너 크기:', safeWidth, 'x', safeHeight);
        console.log('🔍 기존 containerWidth:', containerWidth);
        
        notes = notes.map(note => {
          // ✅ 변수를 함수 내에서 명확하게 정의
          const noteWidth = note.width || 320;
          const noteHeight = note.height || 250;
          
          let x = note.position.x;
          let y = note.position.y;
          
          // 🔧 최소한의 보정만 (음수만 방지)
          if (x < 0) x = 20;
          if (y < 0) y = 20;
          
          // 나머지는 원래 위치 그대로 유지
          
          return {
            ...note,
            position: { x, y },
            width: noteWidth,
            height: noteHeight
          };
        });

        notesReady = true;
      }
    } catch (error) {
      console.error('노트 로드 실패:', error);
      notesReady = true;
    }
  }

  async function addNote() {
    const noteWidth = 320;
    const noteHeight = 250;
    
    let initialX, initialY;
    
    if (isMobile) {
      initialX = Math.max(20, (containerWidth - noteWidth) / 2);
      initialY = Math.max(100, (containerHeight - noteHeight) / 3);
    } else {
      initialX = Math.max(50, (containerWidth - noteWidth) / 2);
      initialY = Math.max(100, (containerHeight - noteHeight) / 2);
    }

    const newNote = {
      body: '',
      colors: colors[0],
      position: { x: initialX, y: initialY },
      width: noteWidth,
      height: noteHeight
    };

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNote)
      });

      if (response.ok) {
        const createdNote = await response.json();
        createdNote.width = noteWidth;
        createdNote.height = noteHeight;
        
        notesReady = false;
        notes = [...notes, createdNote];
        
        notesReady = true;
      }
    } catch (error) {
      console.error('노트 추가 실패:', error);
    }
  }

  function handleMouseDown(e, note) {
    if (e.target.closest('.card-close') || e.target.closest('.color-option') || e.target.closest('.resize-handle')) {
      return;
    }
    
    if (e.target.tagName === 'TEXTAREA') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    
    startDrag(e.clientX, e.clientY, note);
  }

  function handleTouchStart(e, note) {
    if (e.target.closest('.card-close') || e.target.closest('.color-option') || e.target.closest('.resize-handle')) {
      return;
    }
    
    if (e.target.tagName === 'TEXTAREA') {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY, note);
  }

  function startDrag(clientX, clientY, note) {
    isDragging = true;
    selectedNote = note;
    
    offset = {
      x: clientX - note.position.x,
      y: clientY - note.position.y
    };
  }

  function handleResizeStart(e, note) {
    e.preventDefault();
    e.stopPropagation();
    
    isResizing = true;
    resizeNote = note;
    resizeStartSize = {
      width: note.width || 320,
      height: note.height || 250
    };
    resizeStartPos = {
      x: e.clientX || e.touches[0].clientX,
      y: e.clientY || e.touches[0].clientY
    };
  }

  function handleMouseMove(e) {
    if (isDragging && selectedNote) {
      e.preventDefault();
      updatePosition(e.clientX, e.clientY);
    } else if (isResizing && resizeNote) {
      e.preventDefault();
      updateSize(e.clientX, e.clientY);
    }
  }

  function handleTouchMove(e) {
    if (isDragging && selectedNote) {
      e.preventDefault();
      const touch = e.touches[0];
      updatePosition(touch.clientX, touch.clientY);
    } else if (isResizing && resizeNote) {
      e.preventDefault();
      const touch = e.touches[0];
      updateSize(touch.clientX, touch.clientY);
    }
  }

  function updatePosition(clientX, clientY) {
    const noteWidth = selectedNote.width || 320;
    const noteHeight = selectedNote.height || 250;
    
    const newX = clientX - offset.x;
    const newY = clientY - offset.y;

    const boundedX = Math.max(0, Math.min(newX, containerWidth - noteWidth));
    const boundedY = Math.max(0, Math.min(newY, containerHeight - noteHeight));

    selectedNote.position = { x: boundedX, y: boundedY };
    notes = [...notes];
  }

  function updateSize(clientX, clientY) {
    const deltaX = clientX - resizeStartPos.x;
    const deltaY = clientY - resizeStartPos.y;
    
    const newWidth = Math.max(250, Math.min(600, resizeStartSize.width + deltaX));
    const newHeight = Math.max(100, Math.min(800, resizeStartSize.height + deltaY));
    
    resizeNote.width = newWidth;
    resizeNote.height = newHeight;
    notes = [...notes];
  }

  async function handleMouseUp() {
    if (isDragging && selectedNote) {
      await updateNote(selectedNote);
      selectedNote = null;
      isDragging = false;
    } else if (isResizing && resizeNote) {
      await updateNote(resizeNote);
      resizeNote = null;
      isResizing = false;
    }
  }

  async function handleTouchEnd() {
    if (isDragging && selectedNote) {
      await updateNote(selectedNote);
      selectedNote = null;
      isDragging = false;
    } else if (isResizing && resizeNote) {
      await updateNote(resizeNote);
      resizeNote = null;
      isResizing = false;
    }
  }

  async function updateNote(note) {
    try {
      await fetch('/api/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...note,
          width: note.width,
          height: note.height
        })
      });
    } catch (error) {
      console.error('노트 업데이트 실패:', error);
    }
  }

  async function deleteNote(noteId) {
    const noteToDelete = notes.find(n => n.id === noteId);
    if (!noteToDelete) return;
    
    if (user.role !== 'admin' && noteToDelete.user_id !== user.id) {
      console.error('❌ 삭제 권한이 없습니다');
      return;
    }
    try {
      const response = await fetch('/api/notes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: noteId })
      });

      if (response.ok) {
        notes = notes.filter(n => n.id !== noteId);
      }
    } catch (error) {
      console.error('노트 삭제 실패:', error);
    }
  }

  function handleInput(note, e) {
    note.body = e.target.value;
    notes = [...notes];
    debounceUpdate(note);
  }

  let updateTimeout;
  function debounceUpdate(note) {
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
      updateNote(note);
    }, 1000);
  }

  function changeColor(note, color) {
    note.colors = color;
    notes = [...notes];
    updateNote(note);
  }

  async function handleDeleteClick(noteId) {
    await deleteNote(noteId);
  }

  function getNotesContainerWidth() {
    if (!notes || notes.length === 0) return containerWidth || 320;
    
    const maxWidth = Math.max(...notes.map(note => 
      (note.position?.x || 0) + (note.width || 320) + 20
    ));
    
    return Math.max(maxWidth, containerWidth || 320);
  }
</script>

<svelte:head>
  <title>관리자 대시보드</title>
</svelte:head>


<div class="relative min-h-screen bg-white" style="user-select: {isDragging || isResizing ? 'none' : 'auto'};">
  
  <!-- Add Note Button -->
  <button 
    on:click={addNote}
    class="fixed bottom-4 right-4 w-12 h-12 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 z-50"
    title="새 노트 추가"
  >
    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  </button>

  <!-- Page Header -->
  <div class="p-3 md:p-4 pointer-events-none">
    <h2 class="text-lg md:text-xl font-bold text-gray-800">📝 알림판</h2>
  </div>

  <!-- Notes Container -->
  <div 
    class="relative pb-16"
    style="
      min-height: calc(100vh - 120px); 
      width: 100%;
      min-width: {getNotesContainerWidth()}px;
    ">
    
    {#if notesReady}
      {#each notes as note (note.id)}
        <div
          class="absolute rounded-xl shadow-lg transition-shadow duration-100 flex flex-col cursor-grab {selectedNote?.id === note.id ? 'shadow-2xl z-40 cursor-grabbing' : 'z-10'}"
          style="
            left: {note.position.x}px; 
            top: {note.position.y}px; 
            width: {note.width || 320}px;
            height: {note.height || 250}px;
            background-color: {note.colors.colorBody}; 
            color: {note.colors.colorText};
            transform: {selectedNote?.id === note.id || resizeNote?.id === note.id ? 'scale(1.02)' : 'scale(1)'};
          "
          on:mousedown={(e) => handleMouseDown(e, note)}
          on:touchstart={(e) => handleTouchStart(e, note)}
          role="button"
          tabindex="0"
        >
          <!-- Card Header -->
          <div class="p-2 rounded-t-xl flex justify-between items-center cursor-grab flex-shrink-0" style="background-color: {note.colors.colorHeader};">
            <!-- Color Picker -->
            <div class="flex gap-1.5">
              {#each colors as color}
                <button
                  class="color-option w-5 h-5 rounded-full border-2 transition-all duration-200 hover:scale-110 active:scale-95 {note.colors.id === color.id ? 'border-black/30 scale-110' : 'border-transparent'}"
                  style="background-color: {color.colorHeader};"
                  on:click|stopPropagation={() => changeColor(note, color)}
                  on:touchend|stopPropagation|preventDefault={() => changeColor(note, color)}
                ></button>
              {/each}
            </div>

            <!-- Close Button -->
            {#if user && (user.role === 'admin' || note.user_id === user.id)}
              <button 
                class="card-close p-0.5 opacity-60 hover:opacity-100 active:opacity-100 transition-opacity"
                on:click|stopPropagation={() => handleDeleteClick(note.id)}
                on:touchend|stopPropagation|preventDefault={() => handleDeleteClick(note.id)}
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            {/if}
          </div>

          <!-- Card Body -->
          <textarea
            class="flex-1 p-4 bg-transparent border-none outline-none resize-none font-sans text-sm leading-relaxed placeholder:opacity-50 cursor-text overflow-auto"
            style="color: {note.colors.colorText}; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;"
            placeholder="내용을 입력하세요..."
            value={note.body}
            on:input={(e) => handleInput(note, e)}
          ></textarea>
          
         
          {#if note.username || note.user_id || user}
            <div class="text-xs text-gray-500 mt-1 px-4 pb-2">
              작성자: {note.username || user?.username || `사용자${note.user_id || user?.id}`}
            </div>
          {/if}
          <!-- Resize Handle -->
          <div 
            class="resize-handle absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize opacity-40 hover:opacity-80 transition-opacity"
            on:mousedown|stopPropagation={(e) => handleResizeStart(e, note)}
            on:touchstart|stopPropagation|preventDefault={(e) => handleResizeStart(e, note)}
          >
            <svg class="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 22H20V20H22V22M22 18H20V16H22V18M18 22H16V20H18V22M18 18H16V16H18V18M14 22H12V20H14V22M22 14H20V12H22V14Z"/>
            </svg>
          </div>
        </div>
      {/each}
    {:else}
      <!-- Loading -->
      <div class="flex items-center justify-center h-32">
        <div class="text-gray-500">노트를 불러오는 중...</div>
      </div>
    {/if}
  </div>
</div>

<style>
  textarea {
    touch-action: none;
  }
  
  .resize-handle {
    touch-action: none;
  }

</style>