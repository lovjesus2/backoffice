<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  export let data;  // ← 이미 있음 (정상)
  
  // let user = null;  // ← 이 줄 제거
  $: user = data?.user;  // ← 이렇게 변경

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
        const apiData = await response.json();
        
        // 🚫 이 부분 제거
        // if (data.user && !user) {
        //   user = data.user;
        // }
        
        notes = apiData.notes || apiData;  // API에서는 notes만 받음
        
        // 🔧 데이터 파싱 수정
        notes = notes.map(note => {
          const noteWidth = note.width || 320;
          const noteHeight = note.height || 250;
          
          let x = note.position.x;
          let y = note.position.y;
          
          if (x < 0) x = 20;
          if (y < 0) y = 20;
          
          // 🎯 체크리스트 데이터 파싱 추가
          let checkItems = [];
          if (note.check_items) {
            try {
              checkItems = typeof note.check_items === 'string' 
                ? JSON.parse(note.check_items) 
                : note.check_items;
            } catch (e) {
              console.error('체크리스트 파싱 오류:', e);
              checkItems = [];
            }
          }
          
          return {
            ...note,
            position: { x, y },
            width: noteWidth,
            height: noteHeight,
            note_type: note.note_type || 'text',
            check_items: Array.isArray(checkItems) ? checkItems : []  // 🎯 배열 보장
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
      height: noteHeight,
      note_type: 'text',    // 추가
      check_items: []       // 추가
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
    // 🎯 INPUT 관련 요소는 완전히 무시
    if (e.target.tagName === 'INPUT' || 
        e.target.closest('input') || 
        e.target.closest('.checklist-container')) {
      return; // preventDefault 호출하지 않음!
    }
    
    if (e.target.closest('.card-close') || e.target.closest('.color-option') || e.target.closest('.resize-handle')) {
      return;
    }
    
    if (e.target.tagName === 'TEXTAREA') {
      return;
    }

    e.preventDefault(); // 여기서만 preventDefault 호출
    e.stopPropagation();
    
    startDrag(e.clientX, e.clientY, note);
  }

  function handleTouchStart(e, note) {
    // 🎯 INPUT 관련 요소는 완전히 무시
    if (e.target.tagName === 'INPUT' || 
        e.target.closest('input') || 
        e.target.closest('.checklist-container')) {
      return; // preventDefault 호출하지 않음!
    }
    
    if (e.target.closest('.card-close') || e.target.closest('.color-option') || e.target.closest('.resize-handle')) {
      return;
    }
    
    if (e.target.tagName === 'TEXTAREA') {
      return;
    }

    e.preventDefault(); // 여기서만 preventDefault 호출
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
          height: note.height,
          note_type: note.note_type || 'text',      // 추가
          check_items: note.check_items || []       // 추가
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

  // 체크 항목 제거
  function removeCheckItem(note, index) {
    note.check_items.splice(index, 1);
    notes = [...notes];
    debounceUpdateNote(note);
  }

  // 디바운스된 업데이트
  let noteUpdateTimeout;
  function debounceUpdateNote(note) {
    clearTimeout(noteUpdateTimeout);
    noteUpdateTimeout = setTimeout(() => {
      updateNote(note);
    }, 500);
  }

  // 체크리스트 키보드 이벤트 처리
  function handleCheckItemKeydown(e, note, index) {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // 새 항목 추가
      if (!note.check_items) note.check_items = [];
      note.check_items.splice(index + 1, 0, { text: '', checked: false });
      notes = [...notes];
      
      // 다음 항목으로 포커스 이동
      setTimeout(() => {
        const inputs = document.querySelectorAll('.checklist-container input[type="text"]');
        const nextInput = inputs[index + 1];
        if (nextInput) {
          nextInput.focus();
        }
      }, 10);
      
    } else if (e.key === 'ArrowUp') {
      // 🎯 위쪽 화살표: 이전 항목으로 이동
      e.preventDefault();
      const inputs = document.querySelectorAll('.checklist-container input[type="text"]');
      const prevInput = inputs[index - 1];
      if (prevInput) {
        prevInput.focus();
        prevInput.setSelectionRange(prevInput.value.length, prevInput.value.length);
      }
      
    } else if (e.key === 'ArrowDown') {
      // 🎯 아래쪽 화살표: 다음 항목으로 이동
      e.preventDefault();
      const inputs = document.querySelectorAll('.checklist-container input[type="text"]');
      const nextInput = inputs[index + 1];
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(0, 0); // 커서를 맨 앞으로
      }
      
    } else if (e.key === 'Backspace' && e.target.value === '' && note.check_items.length > 1) {
      // 빈 항목에서 백스페이스 누르면 삭제
      e.preventDefault();
      
      note.check_items.splice(index, 1);
      notes = [...notes];
      
      // 이전 항목으로 포커스 이동
      setTimeout(() => {
        const inputs = document.querySelectorAll('.checklist-container input[type="text"]');
        const prevInput = inputs[Math.max(0, index - 1)];
        if (prevInput) {
          prevInput.focus();
          prevInput.setSelectionRange(prevInput.value.length, prevInput.value.length);
        }
      }, 10);
      
      debounceUpdateNote(note);
    }
  }

  // 체크박스로 모드 토글
  function toggleNoteType(note, isChecklist) {
    const newType = isChecklist ? 'checklist' : 'text';
    
    if (note.note_type === newType) return;
    
    const oldType = note.note_type;
    note.note_type = newType;
    
    if (newType === 'checklist' && oldType === 'text') {
      // 텍스트를 체크리스트로 변환
      if (note.body && note.body.trim()) {
        const lines = note.body.split('\n').filter(line => line.trim());
        note.check_items = lines.map(line => {
          let text = line.trim();
          let checked = false;
          
          // 기존 체크 마크 제거
          if (text.startsWith('✓ ')) {
            text = text.substring(2);
            checked = true;
          } else if (text.startsWith('○ ')) {
            text = text.substring(2);
            checked = false;
          }
          
          return { text, checked };
        });
      } else {
        note.check_items = [{ text: '', checked: false }];
      }
      note.body = '';
    } else if (newType === 'text' && oldType === 'checklist') {
      // 체크리스트를 텍스트로 변환
      if (note.check_items && note.check_items.length > 0) {
        note.body = note.check_items
          .filter(item => item.text.trim()) // 빈 항목 제외
          .map(item => `${item.checked ? '✓' : '○'} ${item.text}`)
          .join('\n');
      }
      note.check_items = [];
    }
    
    notes = [...notes];
    updateNote(note);
  }

  // 노트 수정 권한 체크 함수
  function canEditNote(note) {
    if (!user) return false;
    return user.role === 'admin' || note.user_id === user.id;
  }

  // 읽기 전용 스타일 클래스 함수
  function getReadonlyClass(note) {
    return canEditNote(note) ? '' : 'opacity-50 cursor-not-allowed';
  }

  // 텍스트 입력 스타일 클래스 함수
  function getInputClass(note) {
    return canEditNote(note) ? '' : 'cursor-not-allowed opacity-70';
  }

</script>

<svelte:head>
  <title>관리자 대시보드</title>
</svelte:head>


<div class="relative min-h-screen bg-white" style="user-select: auto;">
  
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
    <h2 class="text-base md:text-lg font-bold text-gray-800">📋 알림판</h2>
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
          class="absolute rounded-xl shadow-lg transition-shadow duration-100 flex flex-col {canEditNote(note) ? 'cursor-grab' : 'cursor-default'} {selectedNote?.id === note.id ? 'shadow-2xl z-40 cursor-grabbing' : 'z-10'}"
          style="
            left: {note.position.x}px; 
            top: {note.position.y}px; 
            width: {note.width || 320}px;
            height: {note.height || 250}px;
            background-color: {note.colors.colorBody}; 
            color: {note.colors.colorText};
            transform: {selectedNote?.id === note.id || resizeNote?.id === note.id ? 'scale(1.02)' : 'scale(1)'};
          "
            on:mousedown={(e) => canEditNote(note) && handleMouseDown(e, note)}
            on:touchstart={(e) => canEditNote(note) && handleTouchStart(e, note)}
            role="button"
            tabindex="0"
        >
          <!-- Card Header -->
          <div class="p-2 rounded-t-xl flex justify-between items-center {canEditNote(note) ? 'cursor-grab' : 'cursor-default'} flex-shrink-0" style="background-color: {note.colors.colorHeader};">
            <!-- 왼쪽 그룹: 체크박스 + 컬러 -->
            <div class="flex items-center gap-2">
              <!-- 🎯 체크리스트 토글 체크박스 -->
              <label class="flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={note.note_type === 'checklist'}
                  disabled={!canEditNote(note)}
                  on:change={(e) => toggleNoteType(note, e.target.checked)}
                  on:click|stopPropagation
                  class="w-4 h-4 rounded border-2 {getReadonlyClass(note)}"
                />
              </label>
              
              <!-- Color Picker -->
              <div class="flex gap-1.5">
                {#each colors as color}
                  <button
                    class="color-option w-5 h-5 rounded-full border-2 transition-all duration-200 {canEditNote(note) ? 'hover:scale-110 active:scale-95' : 'cursor-not-allowed opacity-50'} {note.colors.id === color.id ? 'border-black/30 scale-110' : 'border-transparent'}"
                    style="background-color: {color.colorHeader};"
                    disabled={!canEditNote(note)}
                    on:click|stopPropagation={() => canEditNote(note) && changeColor(note, color)}
                    on:touchend|stopPropagation|preventDefault={() => canEditNote(note) && changeColor(note, color)}
                  ></button>
                {/each}
              </div>
            </div>

            <!-- 오른쪽: 닫기 버튼 -->
            {#if canEditNote(note)}
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

          <!-- Card Body - 기존 textarea 대체 -->
          {#if note.note_type === 'checklist'}
            <!-- 체크리스트 모드 -->
            <div class="checklist-container flex-1 p-4 overflow-auto" style="user-select: text;">
              {#each note.check_items || [] as item, index}
                <div class="flex items-center gap-2 mb-2">
                  <input 
                    type="checkbox" 
                    bind:checked={item.checked}
                    disabled={!canEditNote(note)}
                    on:change={() => {
                      notes = [...notes];
                      debounceUpdateNote(note);
                    }}
                    class="w-4 h-4 rounded border-2 {getReadonlyClass(note)}"
                  />
                  <input 
                    type="text" 
                    bind:value={item.text}
                    readonly={!canEditNote(note)}
                    on:input={() => {
                      notes = [...notes];
                      debounceUpdateNote(note);
                    }}
                    on:keydown={(e) => {
                      if (!canEditNote(note)) {
                        e.preventDefault();
                        return;
                      }
                      handleCheckItemKeydown(e, note, index);
                    }}
                    placeholder="할 일을 입력하세요..."
                    class="flex-1 bg-transparent border-none outline-none text-xs md:text-xs {getInputClass(note)}"
                    style="color: {note.colors.colorText};"
                  />
                  {#if canEditNote(note)}
                    <button 
                      on:click|stopPropagation={() => removeCheckItem(note, index)}
                      on:touchend|stopPropagation|preventDefault={() => removeCheckItem(note, index)}
                      class="w-6 h-6 rounded-full bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center text-red-600 text-xs"
                    >×</button>
                  {/if}
                </div>
              {/each}
            </div>
          {:else}
            <!-- 기존 텍스트 모드 -->
            <textarea
              class="flex-1 p-4 bg-transparent border-none outline-none resize-none font-sans text-xs md:text-xs leading-relaxed placeholder:opacity-50 cursor-text overflow-auto"
              style="color: {note.colors.colorText}; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;"
              placeholder="내용을 입력하세요..."
              value={note.body}
              on:input={(e) => handleInput(note, e)}
            ></textarea>
          {/if}
          
          {#if note.username || note.user_id || user}
            <div class="text-xs text-gray-500 mt-1 px-4 pb-2">
              작성자: {note.username || user?.username || `사용자${note.user_id || user?.id}`}
            </div>
          {/if}
          <!-- Resize Handle -->
          {#if canEditNote(note)}
            <div 
              class="resize-handle absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize opacity-40 hover:opacity-80 transition-opacity"
              on:mousedown|stopPropagation={(e) => handleResizeStart(e, note)}
              on:touchstart|stopPropagation|preventDefault={(e) => handleResizeStart(e, note)}
            >
              <svg class="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 22H20V20H22V22M22 18H20V16H22V18M18 22H16V20H18V22M18 18H16V16H18V18M14 22H12V20H14V22M22 14H20V12H22V14Z"/>
              </svg>
            </div>
          {/if}
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