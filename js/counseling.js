/* ==========================================
   counseling.js - 학생 상담일지 관리 모듈
   ========================================== */

/** 상담 지도 방법 자동 추천 DB */
const GUIDANCE_SUGGESTIONS = {
  // 긍정 행동
  'p1': '지속적인 칭찬과 격려를 통해 학습 의욕을 고취함. 모범 사례로 학급에 소개해 자긍심을 높임.',
  'p2': '발표 능력의 우수함을 인정하고, 더 깊이 있는 질문을 하도록 유도하여 비판적 사고력을 키움.',
  'p3': '협동의 즐거움을 알게 하고, 또래 멘토로서 활동할 수 있는 기회를 부여하여 리더십을 지원함.',
  'p4': '과제 수행의 성실함을 기반으로 자기주도적 학습 습관을 더욱 공고히 하도록 지도함.',
  'p5': '창의적인 생각을 구체화할 수 있는 관련 심화 자료를 안내하고, 결과물을 학급 게시판에 공유함.',
  
  // 부정 행동
  'n1': '수면 원인(가정 내 수면 습관 등)을 파악하고, 수업 전 환기 및 스트레칭을 유도하여 주의를 환기함.',
  'n2': '주변 학생과의 상호작용 방식에 대해 지도하고, 집중력이 필요한 교과 시간에는 좌석 배치를 조정함.',
  'n3': '스마트폰 사용의 역효과에 대해 개별 면담을 진행하고, 학급 내 스마트폰 보관 규칙을 재강조함.',
  'n4': '과제 미제출의 기술적/심리적 요인을 확인하고, 단계별 과제 수행 계획을 세워 성취감을 느끼게 함.',
  'n5': '갈등 해결을 위한 대화법(나-전달법)을 지도하고, 상대방의 입장을 이해하는 공감 중심 상담을 진행함.',
  'n6': '무단 이탈의 위험성과 교내 안전 규칙을 교육하고, 학교 생활의 흥미 요소를 찾아 정서적 지지를 제공함.',
  
  // 기본 안내
  'default_positive': '긍정적 변화를 적극 격려하고, 앞으로의 성장을 기대하며 지속적인 모니터링을 약속함.',
  'default_negative': '해당 행동의 영향력을 학생 스스로 깨닫게 하고, 구체적인 개선 목표를 설정하여 실천하도록 독려함.'
};

/** 상담일지 초기화 및 이벤트 등록 */
function initCounseling() {
  updateCounselingFilters();
  
  // 버튼 이벤트
  document.getElementById('btnNewCounseling')?.addEventListener('click', () => openCounselingModal());
  document.getElementById('btnCloseCounseling')?.addEventListener('click', closeCounselingModal);
  document.getElementById('btnCancelCounseling')?.addEventListener('click', closeCounselingModal);
  document.getElementById('btnSaveCounseling')?.addEventListener('click', saveCounselingLog);
  document.getElementById('btnSuggestGuidance')?.addEventListener('click', autoSuggestGuidance);
  
  // 필터 변경 이벤트
  document.getElementById('counselingPeriodFilter')?.addEventListener('change', renderCounselingList);
  document.getElementById('counselingStudentFilter')?.addEventListener('change', renderCounselingList);
  
  // 학생 선택 시 행동 기록 가져오기 연동
  document.getElementById('inputCounselingStudent')?.addEventListener('change', updateBehaviorChecklist);
  document.getElementById('autoFetchPeriod')?.addEventListener('change', updateBehaviorChecklist);

  // PDF 관련
  document.getElementById('btnClosePdfPreview')?.addEventListener('click', () => document.getElementById('pdfPreviewModal').classList.add('hidden'));
  document.getElementById('btnPrintLog')?.addEventListener('click', () => {
    const element = document.getElementById('pdfPreviewContainer');
    const studentName = document.getElementById('inputCounselingStudent').options[document.getElementById('inputCounselingStudent').selectedIndex]?.text || '상담일지';
    const opt = {
      margin: 10,
      filename: `상담일지_${studentName}_${todayStr()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  });
}

/** 상담일지 목록 렌더링 */
function renderCounselingList() {
  const listContainer = document.getElementById('counselingList');
  const period = document.getElementById('counselingPeriodFilter').value;
  const student = document.getElementById('counselingStudentFilter').value;
  
  const cls = getCurrentClass();
  if (!cls) return;

  let records = appState.counselingRecords || [];

  // 필터링 레이크
  if (student !== 'all') {
    records = records.filter(r => r.studentId === student);
  }
  
  if (period !== 'all') {
    const now = new Date();
    records = records.filter(r => {
      const d = new Date(r.date);
      if (period === 'week') return (now - d) < 7 * 24 * 60 * 60 * 1000;
      if (period === 'month') return (now - d) < 30 * 24 * 60 * 60 * 1000;
      // 학기 필터는 appState.termSettings.startDate 기준으로 처리 (단순화)
      if (period === 'term' && appState.termSettings.startDate) {
        return d >= new Date(appState.termSettings.startDate);
      }
      return true;
    });
  }

  records.sort((a,b) => new Date(b.date) - new Date(a.date));

  if (records.length === 0) {
    listContainer.innerHTML = '<div class="empty-state">기록된 상담일지가 없습니다.</div>';
    return;
  }

  listContainer.innerHTML = records.map(r => {
    const s = getStudents(cls.id).find(st => st.id === r.studentId);
    if (!s) return '';
    return `
      <div class="counseling-card">
        <div class="counseling-card-main">
          <div class="c-info">
            <span class="c-student">${s.number}번 ${s.name}</span>
            <span class="c-date">${new Date(r.date).toLocaleString()}</span>
          </div>
          <div class="c-content text-truncate">${r.content || '내용 없음'}</div>
        </div>
        <div class="counseling-card-actions">
          <button class="btn btn-secondary btn-sm" onclick="previewCounselingLog('${r.id}')">🖨️ PDF</button>
          <button class="btn btn-secondary btn-sm" onclick="editCounselingLog('${r.id}')">✏️ 수정</button>
          <button class="btn btn-danger btn-sm" onclick="deleteCounselingLog('${r.id}')">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

/** 상담 모달 열기 (신규/수정) */
function openCounselingModal(editingRecord = null) {
  const modal = document.getElementById('counselingModal');
  const title = document.getElementById('counselingModalTitle');
  const cls = getCurrentClass();
  
  // 학생 선택 드롭다운 갱신
  const studentSelect = document.getElementById('inputCounselingStudent');
  studentSelect.innerHTML = '<option value="">선택하세요</option>';
  const students = getStudents(cls.id);
  students.forEach(s => {
    studentSelect.innerHTML += `<option value="${s.id}">${s.number}번 ${s.name}</option>`;
  });

  if (editingRecord) {
    title.textContent = '상담일지 수정';
    modal.dataset.mode = 'edit';
    modal.dataset.id = editingRecord.id;
    studentSelect.value = editingRecord.studentId;
    document.getElementById('inputCounselingDate').value = editingRecord.date;
    document.getElementById('inputCounselingPlace').value = editingRecord.place || '';
    document.getElementById('inputCounselingContent').value = editingRecord.content || '';
    document.getElementById('inputCounselingGuidance').value = editingRecord.guidance || '';
    updateBehaviorChecklist(editingRecord.behaviorIds);
  } else {
    title.textContent = '새 상담일지 작성';
    modal.dataset.mode = 'new';
    modal.dataset.id = '';
    studentSelect.value = '';
    // 현재 시간으로 기본값 설정 (YYYY-MM-DDThh:mm)
    const now = new Date();
    const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    document.getElementById('inputCounselingDate').value = localNow;
    document.getElementById('inputCounselingPlace').value = '교실';
    document.getElementById('inputCounselingContent').value = '';
    document.getElementById('inputCounselingGuidance').value = '';
    document.getElementById('behaviorChecklist').innerHTML = '<div class="empty-state" style="padding:10px; font-size:0.8rem;">학생을 선택하면 해당 기간의 행동 기록이 나타납니다.</div>';
  }

  modal.classList.remove('hidden');
}

function closeCounselingModal() {
  document.getElementById('counselingModal').classList.add('hidden');
}

/** 학생 선택 시 해당 기간 행동 기록 로드 */
function updateBehaviorChecklist(selectedIds = []) {
  const studentId = document.getElementById('inputCounselingStudent').value;
  const period = document.getElementById('autoFetchPeriod').value;
  const container = document.getElementById('behaviorChecklist');

  if (!studentId) {
    container.innerHTML = '<div class="empty-state" style="padding:10px; font-size:0.8rem;">학생을 선택해주세요.</div>';
    return;
  }

  const cls = getCurrentClass();
  let behaviors = appState.behaviors.filter(b => b.studentId === studentId && b.classId === cls.id);
  
  // 기간 필터링
  const now = new Date();
  behaviors = behaviors.filter(b => {
    const d = new Date(b.date);
    if (period === 'week') return (now - d) < 7 * 24 * 60 * 60 * 1000;
    if (period === 'month') return (now - d) < 30 * 24 * 60 * 60 * 1000;
    if (period === 'term' && appState.termSettings.startDate) return d >= new Date(appState.termSettings.startDate);
    return true;
  });

  if (behaviors.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:10px; font-size:0.8rem;">해당 기간의 행동 기록이 없습니다.</div>';
    return;
  }

  container.innerHTML = behaviors.map(b => `
    <label class="behavior-check-item">
      <input type="checkbox" name="behaviorItem" value="${b.id}" data-label="${b.label}" data-type="${b.type}" ${selectedIds.includes(b.id) ? 'checked' : ''}>
      <span class="type-tag ${b.type}">${b.type === 'positive' ? '⭐' : '⚠️'}</span>
      <span class="label">${b.label}</span>
      <span class="date">${b.date.slice(5, 10)}</span>
    </label>
  `).join('');
}

/** 지도 방법 자동 추천 엔진 */
function autoSuggestGuidance() {
  const checkedItems = document.querySelectorAll('input[name="behaviorItem"]:checked');
  if (checkedItems.length === 0) {
    showToast('지도 방법을 구성할 행동 기록을 선택해주세요.', 'warning');
    return;
  }

  let suggestions = [];
  checkedItems.forEach(item => {
    const label = item.dataset.label;
    const type = item.dataset.type;
    
    // BEHAVIOR_TYPES에서 매칭되는 ID 찾기 (간접 매핑)
    let behaviorId = null;
    ['positive', 'negative'].forEach(t => {
      const match = BEHAVIOR_TYPES[t].find(bt => bt.label === label);
      if (match) behaviorId = match.id;
    });

    const specificAdvice = GUIDANCE_SUGGESTIONS[behaviorId] || (type === 'positive' ? GUIDANCE_SUGGESTIONS.default_positive : GUIDANCE_SUGGESTIONS.default_negative);
    suggestions.push(`▶ [${label}] 관련:\n   ${specificAdvice}`);
  });

  const guidanceText = document.getElementById('inputCounselingGuidance');
  const currentVal = guidanceText.value.trim();
  const newVal = suggestions.join('\n\n');
  
  if (currentVal) {
    if (confirm('현재 작성된 지도 내용을 유지하면서 아래에 추가하시겠습니까? (취소 시 기존 내용이 대체됩니다.)')) {
      guidanceText.value = currentVal + '\n\n' + newVal;
    } else {
      guidanceText.value = newVal;
    }
  } else {
    guidanceText.value = newVal;
  }
}

/** 상담일지 저장 */
function saveCounselingLog() {
  const modal = document.getElementById('counselingModal');
  const mode = modal.dataset.mode;
  const id = modal.dataset.id || generateId();
  
  const studentId = document.getElementById('inputCounselingStudent').value;
  const date = document.getElementById('inputCounselingDate').value;
  const place = document.getElementById('inputCounselingPlace').value;
  const content = document.getElementById('inputCounselingContent').value;
  const guidance = document.getElementById('inputCounselingGuidance').value;
  
  const behaviorIds = Array.from(document.querySelectorAll('input[name="behaviorItem"]:checked')).map(el => el.value);

  if (!studentId || !date) {
    showToast('학생과 일시를 모두 입력해주세요.', 'error');
    return;
  }

  const record = {
    id, studentId, date, place, content, guidance, behaviorIds,
    updatedAt: new Date().toISOString()
  };

  if (mode === 'edit') {
    const idx = appState.counselingRecords.findIndex(r => r.id === id);
    if (idx !== -1) appState.counselingRecords[idx] = record;
  } else {
    appState.counselingRecords.push(record);
  }

  saveState();
  closeCounselingModal();
  renderCounselingList();
  showToast('상담일지가 저장되었습니다.', 'success');
}

/** 상담일지 삭제 */
function deleteCounselingLog(id) {
  if (!confirm('이 상담일지를 삭제하시겠습니까?')) return;
  appState.counselingRecords = appState.counselingRecords.filter(r => r.id !== id);
  saveState();
  renderCounselingList();
  showToast('상담일지가 삭제되었습니다.', 'warning');
}

/** 상담일지 수정 열기 */
function editCounselingLog(id) {
  const record = appState.counselingRecords.find(r => r.id === id);
  if (record) openCounselingModal(record);
}

/** 상담일지 PDF 미리보기 */
function previewCounselingLog(id) {
  const r = appState.counselingRecords.find(rec => rec.id === id);
  if (!r) return;
  
  const cls = getCurrentClass();
  const s = getStudents(cls.id).find(st => st.id === r.studentId);
  const behaviors = appState.behaviors.filter(b => r.behaviorIds.includes(b.id));

  const modal = document.getElementById('pdfPreviewModal');
  const container = document.getElementById('pdfPreviewContainer');

  // PDF용 HTML 템플릿 (인쇄 전용 스타일 적용 예정)
  let behaviorHtml = behaviors.length > 0 
    ? behaviors.map(b => `<li>[${b.date.slice(5, 10)}] ${b.label}</li>`).join('') 
    : '<li>선택된 기록 없음</li>';

  container.innerHTML = `
    <div class="pdf-document">
      <h1 class="pdf-title">학생 상담 일지</h1>
      <table class="pdf-table">
        <tr>
          <th width="15%">상담학생</th>
          <td width="35%">${s.number}번 ${s.name}</td>
          <th width="15%">상담일시</th>
          <td width="35%">${new Date(r.date).toLocaleString()}</td>
        </tr>
        <tr>
          <th>상담장소</th>
          <td>${r.place || '-'}</td>
          <th>상담자</th>
          <td>담임교사</td>
        </tr>
        <tr>
          <th>관련 행동 기록</th>
          <td colspan="3">
            <ul style="margin:0; padding-left:18px; font-size:0.9rem;">
              ${behaviorHtml}
            </ul>
          </td>
        </tr>
        <tr style="height: 150px; vertical-align: top;">
          <th>상담 내용</th>
          <td colspan="3" style="white-space: pre-wrap;">${r.content || '기록된 내용이 없습니다.'}</td>
        </tr>
        <tr style="height: 200px; vertical-align: top;">
          <th>지도 방법 및 결과</th>
          <td colspan="3" style="white-space: pre-wrap;">${r.guidance || '기록된 결과가 없습니다.'}</td>
        </tr>
      </table>
      <div class="pdf-footer" style="margin-top: 40px; text-align: center; font-size: 1.1rem; font-weight: 500;">
        <p>${new Date().getFullYear()}년 ${new Date().getMonth()+1}월 ${new Date().getDate()}일</p>
        <p style="margin-top: 20px;">지도교사: (인)</p>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
}

/** 필터 드롭다운 갱신 (학급 변경 시 등) */
function updateCounselingFilters() {
  const sel = document.getElementById('counselingStudentFilter');
  if (!sel) return;
  
  sel.innerHTML = '<option value="all">전체 학생</option>';
  const cls = getCurrentClass();
  if (cls) {
    const students = getStudents(cls.id);
    students.forEach(s => {
      sel.innerHTML += `<option value="${s.id}">${s.number}번 ${s.name}</option>`;
    });
  }
}

// 클라우드 버전: auth.js의 onAuthStateChanged → initApp() → initCounseling() 순서로 호출됩니다.
// DOMContentLoaded에서 자동 초기화하지 않습니다.

// 전역 함수 노출 (HTML 인라인 이벤트 핸들러용)
window.renderCounselingList = renderCounselingList;
window.updateCounselingFilters = updateCounselingFilters;
window.previewCounselingLog = previewCounselingLog;
window.editCounselingLog = editCounselingLog;
window.deleteCounselingLog = deleteCounselingLog;
