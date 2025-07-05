<!-- src/routes/admin/common-codes/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  
  export let data;
  
  // 상태 관리
  let majrList = [];
  let selectedMajr = null;
  let leftPanelVisible = true;
  let loading = false;
  let error = '';
  let success = '';
  
  // 검색
  let majrSearchTerm = '';
  
  // 대분류 편집 폼 (신규 입력 모드로 시작)
  let majrEditForm = {
    MAJR_CODE: '',
    MAJR_NAME: '',
    MAJR_BIGO: '',
    MAJR_BIG2: '',
    isNew: true
  };
  
  // 소분류 목록 (편집 가능한 배열)
  let minrList = [];
  let originalMinrList = []; // 원본 데이터 보관
  
  // 모바일에서 백오피스 메뉴 상태 감지
  let backofficeMenuOpen = false;
  
  // 페이지 로드 시 대분류 목록 조회
  onMount(() => {
    // 모바일에서는 초기에 대분류 패널 숨김, PC에서는 표시
    leftPanelVisible = window.innerWidth > 768;
    loadMajrList();
    
    // 백오피스 메뉴 상태 감지
    const detectBackofficeMenu = () => {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        backofficeMenuOpen = sidebar.classList.contains('open');
        // 모바일에서 백오피스 메뉴가 열리면 대분류 패널 숨기기
        if (window.innerWidth <= 768 && backofficeMenuOpen) {
          leftPanelVisible = false;
        }
      }
    };
    
    // MutationObserver로 백오피스 메뉴 상태 변화 감지
    const observer = new MutationObserver(detectBackofficeMenu);
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    }
    
    return () => observer.disconnect();
  });
  
  // 대분류 목록 조회
  async function loadMajrList() {
    try {
      loading = true;
      const params = new URLSearchParams();
      if (majrSearchTerm) params.append('search', majrSearchTerm);
      
      const response = await fetch(`/api/common-codes/majr?${params}`);
      const result = await response.json();
      
      if (result.success) {
        majrList = result.data;
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
  
  // 소분류 목록 조회
  async function loadMinrList(majrCode) {
    try {
      loading = true;
      const params = new URLSearchParams({ majr_code: majrCode });
      
      const response = await fetch(`/api/common-codes/minr?${params}`);
      const result = await response.json();
      
      if (result.success) {
        // 편집 가능한 형태로 변환
        minrList = result.data.map(item => ({
          ...item,
          isNew: false,
          isDeleted: false
        }));
        originalMinrList = JSON.parse(JSON.stringify(result.data));
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
  
  // 대분류 선택
  function selectMajr(majr) {
    selectedMajr = majr;
    majrEditForm = {
      MAJR_CODE: majr.MAJR_CODE,
      MAJR_NAME: majr.MAJR_NAME,
      MAJR_BIGO: majr.MAJR_BIGO || '',
      MAJR_BIG2: majr.MAJR_BIG2 || '',
      isNew: false
    };
    loadMinrList(majr.MAJR_CODE);
    
    // 모바일에서만 왼쪽 패널 숨기기 (데스크탑에서는 숨기지 않음)
    if (window.innerWidth < 768) {
      leftPanelVisible = false;
    }
  }
  
  // 신규 대분류 모드
  function newMajrMode() {
    selectedMajr = null;
    majrEditForm = {
      MAJR_CODE: '',
      MAJR_NAME: '',
      MAJR_BIGO: '',
      MAJR_BIG2: '',
      isNew: true
    };
    minrList = [];
  }
  
  // 행 추가
  function addNewRow() {
    if (!selectedMajr && majrEditForm.isNew && !majrEditForm.MAJR_CODE) {
      error = '먼저 대분류 정보를 입력해주세요.';
      return;
    }
    
    const majrCode = selectedMajr ? selectedMajr.MAJR_CODE : majrEditForm.MAJR_CODE;
    
    const newRow = {
      MINR_MJCD: majrCode,
      MINR_CODE: '',
      MINR_NAME: '',
      MINR_BIGO: '',
      MINR_BIG2: '',
      isNew: true,
      isDeleted: false
    };
    
    minrList = [...minrList, newRow];
  }
  
  // 행 삭제 (화면에서만)
  function deleteRow(index) {
    const item = minrList[index];
    if (item.isNew) {
      // 신규 행이면 배열에서 완전 제거
      minrList = minrList.filter((_, i) => i !== index);
    } else {
      // 기존 행이면 삭제 표시만
      minrList[index].isDeleted = true;
    }
    minrList = [...minrList]; // 반응성 트리거
  }
  
  // 전체 저장 (대분류 + 소분류)
  async function saveAll() {
    try {
      if (!majrEditForm.MAJR_CODE || !majrEditForm.MAJR_NAME) {
        error = '대분류 코드와 명칭을 입력해주세요.';
        return;
      }
      
      loading = true;
      error = '';
      
      // 1. 대분류 저장
      const majrResponse = await fetch('/api/common-codes/majr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...majrEditForm,
          isUpdate: !majrEditForm.isNew
        })
      });
      
      const majrResult = await majrResponse.json();
      if (!majrResult.success) {
        throw new Error(`대분류 저장 실패: ${majrResult.message}`);
      }
      
      // 2. 소분류 저장 (한꺼번에 처리)
      const savePromises = [];
      
      // 삭제된 항목들 처리
      const deletedItems = minrList.filter(item => item.isDeleted && !item.isNew);
      for (const item of deletedItems) {
        savePromises.push(
          fetch(`/api/common-codes/minr?majr_code=${item.MINR_MJCD}&minr_code=${item.MINR_CODE}`, {
            method: 'DELETE'
          })
        );
      }
      
      // 신규/수정 항목들 처리
      const activeItems = minrList.filter(item => !item.isDeleted);
      for (const item of activeItems) {
        if (!item.MINR_CODE || !item.MINR_NAME) continue; // 빈 행 스킵
        
        savePromises.push(
          fetch('/api/common-codes/minr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              MINR_MJCD: majrEditForm.MAJR_CODE,
              MINR_CODE: item.MINR_CODE,
              MINR_NAME: item.MINR_NAME,
              MINR_BIGO: item.MINR_BIGO || '',
              MINR_BIG2: item.MINR_BIG2 || '',
              isUpdate: !item.isNew,
              originalCode: item.isNew ? null : item.MINR_CODE
            })
          })
        );
      }
      
      // 모든 요청 실행
      const results = await Promise.all(savePromises);
      
      // 결과 확인
      for (const response of results) {
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message);
        }
      }
      
      success = '저장이 완료되었습니다.';
      
      // 데이터 새로고침
      await loadMajrList();
      
      // 신규 등록이었다면 해당 대분류 선택
      if (majrEditForm.isNew) {
        const savedMajr = majrList.find(m => m.MAJR_CODE === majrEditForm.MAJR_CODE);
        if (savedMajr) {
          selectMajr(savedMajr);
        }
      } else if (selectedMajr) {
        const updatedMajr = majrList.find(m => m.MAJR_CODE === selectedMajr.MAJR_CODE);
        if (updatedMajr) {
          selectMajr(updatedMajr);
        }
      }
      
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
  
  // 검색 처리
  function handleMajrSearch() {
    loadMajrList();
  }
  
  // 메시지 자동 숨김
  $: if (success) {
    setTimeout(() => success = '', 3000);
  }
  
  $: if (error) {
    setTimeout(() => error = '', 5000);
  }
  
  // 표시할 소분류 목록 (삭제되지 않은 것들만)
  $: visibleMinrList = minrList.filter(item => !item.isDeleted);
  
  // 현재 편집 중인 대분류 코드
  $: currentMajrCode = selectedMajr ? selectedMajr.MAJR_CODE : majrEditForm.MAJR_CODE;
</script>

<svelte:head>
  <title>공통코드 관리</title>
</svelte:head>

<div class="common-code-container">
  <!-- 메인 컨텐츠 -->
  <div class="main-content">
    <!-- 헤더 -->
    <div class="header">
      <div class="header-content">
        <div class="header-left">
          <div class="hamburger-button" on:click={() => leftPanelVisible = !leftPanelVisible}>
            <div class="hamburger-icon">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
          <h1>공통코드 관리</h1>
        </div>
      </div>
    </div>

    <!-- 알림 메시지 -->
    {#if success}
      <div class="alert alert-success">{success}</div>
    {/if}
    
    {#if error}
      <div class="alert alert-error">{error}</div>
    {/if}

    <div class="content-layout">
      <!-- 왼쪽 패널: 대분류 목록 -->
      <div class="left-panel {leftPanelVisible ? 'visible' : 'hidden'}">
        <div class="panel-card">
          <div class="panel-header">
            <h2>대분류 (BISH_MAJR)</h2>
            <button class="panel-close-button" on:click={() => leftPanelVisible = false} title="닫기">×</button>
            
            <!-- 검색 -->
            <div class="search-box">
              <input
                type="text"
                bind:value={majrSearchTerm}
                placeholder="코드 또는 명칭 검색..."
                on:keydown={(e) => e.key === 'Enter' && handleMajrSearch()}
              />
              <button class="btn btn-search" on:click={handleMajrSearch}>검색</button>
            </div>
          </div>
          
          <div class="panel-list">
            {#if loading && !majrList.length}
              <div class="loading">
                <div class="spinner"></div>
                <p>로딩 중...</p>
              </div>
            {:else if majrList.length === 0}
              <div class="no-data">
                등록된 대분류가 없습니다.
              </div>
            {:else}
              {#each majrList as majr}
                <div 
                  class="list-item {selectedMajr && selectedMajr.MAJR_CODE === majr.MAJR_CODE ? 'selected' : ''}"
                  on:click={() => selectMajr(majr)}
                >
                  <div class="item-content">
                    <div class="item-code">{majr.MAJR_CODE}</div>
                    <div class="item-name">{majr.MAJR_NAME}</div>
                    {#if majr.MAJR_BIGO}
                      <div class="item-desc">{majr.MAJR_BIGO}</div>
                    {/if}
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      </div>

      <!-- 오른쪽 패널: 선택된 대분류 편집 및 소분류 목록 -->
      <div class="right-panel">
        <div class="panel-content">
          <!-- 선택된 대분류 편집 -->
          <div class="panel-card">
            <div class="panel-header">
              <h2>
                {majrEditForm.isNew ? '신규 대분류 등록' : `대분류 수정: ${currentMajrCode}`}
              </h2>
              
              <div class="header-buttons">
                <button 
                  class="btn btn-secondary" 
                  on:click={newMajrMode}
                  disabled={loading}
                >
                  신규
                </button>
                <button 
                  class="btn btn-primary" 
                  on:click={saveAll}
                  disabled={loading}
                >
                  {loading ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
            
            <div class="edit-content">
              <div class="edit-grid">
                <div class="edit-item">
                  <label>대분류코드 *</label>
                  <input 
                    type="text" 
                    bind:value={majrEditForm.MAJR_CODE}
                    class="form-control {majrEditForm.isNew ? '' : 'readonly'}"
                    readonly={!majrEditForm.isNew}
                    placeholder="대분류코드 입력"
                  />
                </div>
                <div class="edit-item">
                  <label>대분류명칭 *</label>
                  <input 
                    type="text" 
                    bind:value={majrEditForm.MAJR_NAME}
                    class="form-control"
                    placeholder="대분류명칭 입력"
                  />
                </div>
                <div class="edit-item">
                  <label>비고1</label>
                  <input 
                    type="text" 
                    bind:value={majrEditForm.MAJR_BIGO}
                    class="form-control"
                    placeholder="비고1 입력"
                  />
                </div>
                <div class="edit-item">
                  <label>비고2</label>
                  <input 
                    type="text" 
                    bind:value={majrEditForm.MAJR_BIG2}
                    class="form-control"
                    placeholder="비고2 입력"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 소분류 목록 -->
          <div class="panel-card">
            <div class="panel-header">
              <h3>소분류 (BISH_MINR)</h3>
              
              <div class="header-buttons">
                <button 
                  class="btn btn-success" 
                  on:click={addNewRow}
                  disabled={loading}
                >
                  행추가
                </button>
              </div>
            </div>
            
            <div class="minr-table-container">
              {#if loading && !visibleMinrList.length}
                <div class="loading">
                  <div class="spinner"></div>
                  <p>로딩 중...</p>
                </div>
              {:else}
                <div class="minr-table">
                  <!-- 테이블 헤더 -->
                  <div class="table-header">
                    <div class="col-code">코드</div>
                    <div class="col-name">명칭</div>
                    <div class="col-bigo">비고1</div>
                    <div class="col-big2">비고2</div>
                  </div>
                  
                  <!-- 테이블 바디 -->
                  <div class="table-body">
                    {#each visibleMinrList as item, index}
                      <div class="table-row {item.isNew ? 'new-row' : ''}">
                        <!-- 데스크탑 버전 -->
                        <div class="desktop-row">
                          <div class="col-code">
                            <input 
                              type="text" 
                              bind:value={item.MINR_CODE}
                              class="form-control {item.isNew ? '' : 'readonly'}"
                              readonly={!item.isNew}
                              placeholder="코드"
                            />
                          </div>
                          <div class="col-name">
                            <input 
                              type="text" 
                              bind:value={item.MINR_NAME}
                              class="form-control"
                              placeholder="명칭"
                            />
                          </div>
                          <div class="col-bigo">
                            <input 
                              type="text" 
                              bind:value={item.MINR_BIGO}
                              class="form-control"
                              placeholder="비고1"
                            />
                          </div>
                          <div class="col-big2">
                            <input 
                              type="text" 
                              bind:value={item.MINR_BIG2}
                              class="form-control"
                              placeholder="비고2"
                            />
                          </div>
                          <!-- X 버튼 - 오른쪽 상단 절대 위치 -->
                          <button 
                            class="row-delete-btn"
                            on:click={() => deleteRow(index)}
                            title="삭제"
                          >
                            ×
                          </button>
                        </div>

                        <!-- 모바일 버전 -->
                        <div class="mobile-row">
                          <!-- 첫 번째 줄: 코드 + 명칭 -->
                          <div class="mobile-row-1">
                            <div class="col-code">
                              <div class="mobile-label">코드</div>
                              <input 
                                type="text" 
                                bind:value={item.MINR_CODE}
                                class="form-control {item.isNew ? '' : 'readonly'}"
                                readonly={!item.isNew}
                                placeholder="코드"
                              />
                            </div>
                            <div class="col-name">
                              <div class="mobile-label">명칭</div>
                              <input 
                                type="text" 
                                bind:value={item.MINR_NAME}
                                class="form-control"
                                placeholder="명칭"
                              />
                            </div>
                          </div>

                          <!-- 두 번째 줄: 비고1 + 비고2 -->
                          <div class="mobile-row-2">
                            <div class="col-bigo">
                              <div class="mobile-label">비고1</div>
                              <input 
                                type="text" 
                                bind:value={item.MINR_BIGO}
                                class="form-control"
                                placeholder="비고1"
                              />
                            </div>
                            <div class="col-big2">
                              <div class="mobile-label">비고2</div>
                              <input 
                                type="text" 
                                bind:value={item.MINR_BIG2}
                                class="form-control"
                                placeholder="비고2"
                              />
                            </div>
                          </div>

                          <!-- X 버튼 - 모바일도 오른쪽 상단 -->
                          <button 
                            class="row-delete-btn"
                            on:click={() => deleteRow(index)}
                            title="삭제"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    {/each}
                    
                    {#if visibleMinrList.length === 0}
                      <div class="no-data">
                        등록된 소분류가 없습니다. "행추가" 버튼을 눌러 추가해보세요.
                      </div>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  /* 기본 스타일 */
  .common-code-container {
    min-height: 100vh;
    background-color: #f5f5f5;
    position: relative; /* 부모 컨테이너 위치 기준 */
  }

  /* 헤더 - main-content 안으로 이동됨 */
  .header {
    background: white;
    border-bottom: 1px solid #ddd;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    position: sticky;
    top: 0;
    z-index: 10; /* 백오피스보다 낮게 설정 */
    margin-bottom: 10px;
  }

  .header-content {
    padding: 15px 8px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .header-left h1 {
    margin: 0;
    font-size: 1.5rem;
    color: #333;
    font-weight: 600;
  }

  /* 햄버거 버튼 (헤더 안에 위치) */
  .hamburger-button {
    background: none;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hamburger-button:hover {
    background-color: #f8f9fa;
    border-color: #adb5bd;
  }

  .hamburger-icon {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .hamburger-icon span {
    width: 18px;
    height: 2px;
    background-color: #666;
    transition: all 0.3s ease;
    border-radius: 1px;
  }

  .hamburger-button:hover .hamburger-icon span {
    background-color: #333;
  }

  /* 메인 컨텐츠 - Grid의 main 영역 안에서 Flex 레이아웃 */
  .main-content {
    padding: 0; /* 기존 padding 제거 */
    display: flex;
    flex-direction: column;
    min-height: calc(100vh - 70px); /* 헤더 높이 제외 */
  }

  .content-layout {
    display: flex;
    width: 100%;
    position: relative;
    flex: 1; /* 헤더 다음 남은 공간 모두 차지 */
  }

  /* 왼쪽 패널: 대분류 목록 - Flex item으로 고정 너비 */
  .left-panel {
    flex: 0 0 350px; /* 고정 너비 350px */
    background: transparent;
    transition: all 0.3s ease;
    overflow: hidden;
    z-index: 5; /* 백오피스보다 낮게 설정 */
  }

  .left-panel.hidden {
    flex: 0 0 0; /* 숨길 때 너비 0 */
    opacity: 0;
  }

  .left-panel.visible {
    flex: 0 0 350px;
    opacity: 1;
  }

  /* 오른쪽 패널: 컨텐츠 - Flex item으로 나머지 공간 */
  .right-panel {
    flex: 1; /* 나머지 공간 모두 차지 */
    min-width: 0; /* Flex 오버플로우 방지 */
    padding: 0px 8px;
  }

  .panel-card {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    overflow: hidden;
    margin-bottom: 20px;
  }

  .panel-header {
    padding: 15px 20px;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 15px;
    position: relative;
  }

  /* 대분류 패널만 세로 배치 */
  .left-panel .panel-header {
    flex-direction: column;
    align-items: stretch;
  }

  .panel-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .panel-header h2,
  .panel-header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: #333;
  }

  /* 대분류 패널 X버튼 - 절대위치로 자리 차지 안함 */
  .panel-close-button {
    position: absolute;
    top: 15px;
    right: 15px;
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    transition: all 0.2s;
    z-index: 10;
  }

  .panel-close-button:hover {
    background-color: #c82333;
    transform: scale(1.1);
  }

  .close-button {
    background: none;
    border: 1px solid #ddd;
    border-radius: 4px;
    width: 24px;
    height: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666;
    font-size: 1.2rem;
    transition: all 0.2s;
  }

  .close-button:hover {
    background-color: #f8f9fa;
    border-color: #adb5bd;
    color: #333;
  }

  .header-buttons {
    display: flex;
    gap: 8px;
  }

  .search-box {
    display: flex;
    gap: 8px;
    width: 100%; /* 전체 너비 사용 */
  }

  .search-box input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .search-box input:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
  }

  /* 목록 스타일 */
  .panel-list {
    max-height: 500px;
    overflow-y: auto;
  }

  .list-item {
    padding: 12px 20px;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .list-item:hover {
    background-color: #f8f9fa;
  }

  .list-item.selected {
    background-color: #e3f2fd;
    border-left: 4px solid #2196f3;
  }

  .item-content {
    display: flex;
    flex-direction: column;
  }

  .item-code {
    font-weight: 600;
    color: #333;
    font-size: 0.95rem;
  }

  .item-name {
    color: #666;
    font-size: 0.9rem;
    margin-top: 2px;
  }

  .item-desc {
    color: #999;
    font-size: 0.8rem;
    margin-top: 2px;
  }

  /* 편집 컨텐츠 */
  .edit-content {
    padding: 15px 20px;
  }

  .edit-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
  }

  .edit-item {
    display: flex;
    flex-direction: column;
  }

  .edit-item label {
    font-size: 0.9rem;
    font-weight: 600;
    color: #666;
    margin-bottom: 5px;
  }

  /* 소분류 테이블 */
  .minr-table-container {
    padding: 15px 10px;
  }

  .minr-table {
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow: hidden;
  }

  /* 데스크탑 버전 */
  .desktop-row {
    display: grid;
    grid-template-columns: 120px 1fr 150px 150px; /* actions 컬럼 제거 */
    border-bottom: 1px solid #eee;
    position: relative; /* x 버튼 배치를 위한 relative */
  }

  .mobile-row {
    display: none;
  }

  .table-header,
  .desktop-row {
    border-bottom: 1px solid #eee;
  }

  .table-header {
    background-color: #f8f9fa;
    font-weight: 600;
    color: #333;
    font-size: 0.9rem;
    display: grid;
    grid-template-columns: 120px 1fr 150px 150px; /* actions 컬럼 제거 */
  }

  .table-header > div,
  .desktop-row > div {
    padding: 10px 6px;
    display: flex;
    align-items: center;
    border-right: 1px solid #eee;
  }

  .table-header > div:last-child,
  .desktop-row > div:last-child {
    border-right: none;
  }

  /* 소분류 X 버튼 - 오른쪽 최상단 절대 위치 */
  .row-delete-btn {
    position: absolute;
    top: 0; /* 최대한 위로 */
    right: 0; /* 최대한 오른쪽으로 */
    background: #dc3545;
    color: white;
    border: none;
    border-radius: 50%;
    width: 18px;
    height: 18px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    z-index: 10;
  }

  .row-delete-btn:hover {
    background-color: #c82333;
    transform: scale(1.2);
  }

  .table-row {
    background-color: white;
  }

  .table-row:hover {
    background-color: #f8f9fa;
  }

  .table-row.new-row {
    background-color: #fff3cd;
  }

  .table-row.new-row:hover {
    background-color: #ffeaa7;
  }

  .table-body {
    max-height: 400px;
    overflow-y: auto;
  }

  /* 폼 요소 */
  .form-control {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.9rem;
    box-sizing: border-box;
  }

  .form-control:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
  }

  .form-control.readonly {
    background-color: #f8f9fa;
    color: #6c757d;
  }

  /* 버튼 스타일 */
  .btn {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.2s;
    text-decoration: none;
    display: inline-block;
    text-align: center;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background-color: #007bff;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #0056b3;
  }

  .btn-secondary {
    background-color: #6c757d;
    color: white;
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: #545b62;
  }

  .btn-success {
    background-color: #28a745;
    color: white;
  }

  .btn-success:hover:not(:disabled) {
    background-color: #1e7e34;
  }

  .btn-search {
    background-color: #6c757d;
    color: white;
    padding: 6px 12px;
  }

  .btn-search:hover {
    background-color: #545b62;
  }

  .btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 1.2rem;
    font-weight: bold;
    transition: all 0.2s;
  }

  .btn-icon.delete {
    color: #dc3545;
  }

  .btn-icon.delete:hover {
    background-color: #f8d7da;
  }

  /* 알림 스타일 */
  .alert {
    padding: 10px 15px;
    border-radius: 4px;
    margin: 10px 8px;
    font-size: 0.9rem;
  }

  .alert-success {
    background-color: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
  }

  .alert-error {
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
  }

  /* 로딩 스타일 */
  .loading {
    text-align: center;
    padding: 30px 15px;
    color: #666;
  }

  .spinner {
    width: 25px;
    height: 25px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #007bff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 10px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* 빈 상태 */
  .no-data {
    text-align: center;
    padding: 30px 15px;
    color: #999;
    font-size: 0.9rem;
  }

  /* 반응형 디자인 */
  @media (min-width: 1025px) {
    /* 데스크탑에서 헤더가 백오피스 메뉴를 침범하지 않도록 */
    .header {
      margin-left: 10px; /* 백오피스 사이드바 너비만큼 여백 */
    }
    
    .left-panel {
      margin-left: 10px; /* PC에서만 오른쪽으로 이동 */
    }
  }

  @media (max-width: 1024px) {
    /* 태블릿/모바일에서 대분류 패널을 오버레이로 변경 */
    .left-panel {
      position: fixed;
      left: 0;
      top: 70px;
      height: calc(100vh - 70px);
      z-index: 80; /* 백오피스 메뉴(100)보다 낮게 */
      background: white;
      box-shadow: 2px 0 8px rgba(0,0,0,0.1);
    }
    
    .left-panel.hidden {
      transform: translateX(-100%);
    }
    
    .left-panel.visible {
      transform: translateX(0);
    }
    
    /* 오른쪽 패널이 전체 너비 차지 */
    .right-panel {
      flex: 1;
      width: 100%;
    }

    /* 태블릿에서 헤더 margin 제거 */
    .header {
      margin-left: 0;
    }
  }

  @media (max-width: 768px) {
    .header-content {
      padding: 10px 5px;
    }

    .header-left {
      gap: 10px;
    }

    .header-left h1 {
      font-size: 1.3rem;
    }

    .right-panel {
      padding: 10px 5px;
    }

    .edit-grid {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    /* 모바일에서 버튼 위치 개선 - 절대 위치로 오른쪽 상단에 고정 */
    .panel-header {
      padding: 10px 15px 10px 15px;
      position: relative;
      min-height: 50px; /* 최소 높이 보장 */
    }

    .panel-header h2,
    .panel-header h3 {
      margin: 0;
      padding-right: 120px; /* 버튼 영역 확보 */
      line-height: 1.2;
    }

    .header-buttons {
      position: absolute;
      top: 10px;
      right: 15px;
      display: flex;
      gap: 8px;
      z-index: 5;
    }

    /* 대분류 패널에서는 기본 배치 유지 */
    .left-panel .panel-header {
      flex-direction: column;
      align-items: stretch;
      position: relative;
      min-height: auto;
    }

    .left-panel .panel-header h2 {
      padding-right: 30px; /* X버튼 공간만 확보 */
    }

    .search-box {
      max-width: none;
    }

    .minr-table-container {
      padding: 10px 5px;
    }

    /* 모바일에서 대분류 패널 z-index 더 낮게 */
    .left-panel {
      z-index: 50; /* 백오피스 메뉴보다 훨씬 낮게 */
    }

    /* 모바일 소분류 테이블 - 두 줄 구조 */
    .table-header {
      display: none; /* 모바일에서는 헤더 숨김 */
    }

    .desktop-row {
      display: none; /* 모바일에서는 데스크탑 행 숨김 */
    }

    .mobile-row {
      display: block; /* 모바일에서는 모바일 행 표시 */
      position: relative; /* x 버튼 배치를 위한 relative */
    }

    .table-row {
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-bottom: 10px;
      padding: 10px;
      background: white;
    }

    .table-row.new-row {
      background-color: #fff3cd;
      border-color: #ffeaa7;
    }

    .mobile-row-1 {
      display: grid;
      grid-template-columns: 80px 1fr; /* 작업 컬럼 제거 */
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
    }

    .mobile-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .col-code,
    .col-name,
    .col-bigo,
    .col-big2,
    .col-actions {
      padding: 0;
      border: none;
    }

    .mobile-label {
      font-size: 0.7rem;
      color: #666;
      margin-bottom: 2px;
      font-weight: 600;
    }

    .form-control {
      font-size: 0.8rem;
      padding: 5px 6px;
      width: 100%;
    }

    .minr-table {
      border: none;
    }

    .table-body {
      max-height: none;
    }

    .btn-icon.delete {
      font-size: 1.4rem;
      padding: 2px 6px;
    }
  }
</style>