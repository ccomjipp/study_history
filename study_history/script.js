// ==========================================
// [이음이 역사 공부] 프론트엔드 핵심 로직 파일
// ==========================================

const regions = ["한국", "일본", "중국", "동남아시아", "서남아시아", "중앙아시아", "중동", "유럽", "아프리카", "북미", "남미", "기타"];
const SCALE_Y = 10;     // 1년당 세로 폭 (10px)
const OFFSET_Y = 3000;  // 기원전(BC) 3000년을 좌표계의 0점으로 설정

let events = [];        // 서버 또는 로컬에서 불러온 역사 사건 JSON 배열
let selectedID = null;  // 현재 사용자가 마우스나 커서로 선택한 이벤트 ID
let currentUserID = ""; // 로그인 성공 시 저장할 사용자 ID

window.app = {
    // 1. 로그인 검증 함수 (Netlify 서버리스 함수 auth.js 호출)
    login: async () => {
        const userID = document.getElementById('login-id').value.trim();
        const password = document.getElementById('login-pw').value.trim();

        if (!userID || !password) {
            alert("ID와 비밀번호를 모두 입력해주세요.");
            return;
        }

        try {
            alert("입력 OK");
            const res = await fetch('/.netlify/functions/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userID, password })
            });

            const result = await res.json();

            if (res.ok && result.success) {
                currentUserID = userID;
                // 로그인 창 숨기고 메인 화면 표시
                document.getElementById('login-overlay').style.display = 'none';
                document.getElementById('app-container').style.display = 'flex';
                
                // 시스템 초기화 및 데이터 로드
                app.init();
                await app.loadData();
            } else {
                alert(result.message || "로그인 정보가 올바르지 않습니다.");
            }
        } catch (err) {
            console.error("로그인 통신 에러:", err);
            alert("서버와 통신 중 오류가 발생했습니다. Netlify Functions 상태를 확인하세요.");
        }
    },

    // 2. 눈금자 및 UI 초기 생성 함수
    init: () => {
        // 상단 권역 헤더 동적 생성
        const header = document.getElementById('region-header');
        const select = document.getElementById('in-placeGroup');
        header.innerHTML = '';
        select.innerHTML = '<option value="">권역 선택 (필수)</option>';
        
        regions.forEach(r => {
            header.innerHTML += `<div class="region-label" style="min-width:200px; text-align:center; line-height:40px; border-right:1px solid #555;">${r}</div>`;
            select.innerHTML += `<option value="${r}">${r}</option>`;
        });

        // 좌측 연도 눈금자 동적 생성 (BC 3000년 ~ AD 2026년까지 100년 단위)
        const ruler = document.getElementById('year-ruler');
        ruler.innerHTML = '';
        ruler.style.position = 'relative';
        
        for (let y = -3000; y <= 2026; y += 100) {
            const label = document.createElement('div');
            label.className = 'year-label';
            label.style.position = 'absolute';
            label.style.width = '100%';
            label.style.textAlignment = 'right';
            label.style.paddingRight = '10px';
            label.style.fontSize = '11px';
            label.style.color = '#777';
            label.style.top = `${(y + OFFSET_Y) * SCALE_Y}px`;
            label.innerText = y < 0 ? `BC ${Math.abs(y)}` : `AD ${y}`;
            ruler.appendChild(label);
        }
    },

    // 3. 백엔드 데이터 불러오기 (data.js 호출)
    loadData: async () => {
        try {
            const res = await fetch(`/.netlify/functions/data?userID=${currentUserID}`);
            if (res.ok) {
                events = await res.json();
                app.render();
            }
        } catch (err) {
            console.error("데이터 로드 실패:", err);
        }
    },

    // 4. 백엔드 데이터 저장하기 (data.js 호출)
    saveData: async () => {
        try {
            await fetch(`/.netlify/functions/data?userID=${currentUserID}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(events)
            });
            app.render();
        } catch (err) {
            console.error("데이터 저장 실패:", err);
            alert("서버에 데이터를 저장하지 못했습니다.");
        }
    },

    // 5. 역사 사건 추가 및 수정 로직
    addEvent: () => {
        const startYearEl = document.getElementById('in-startYear');
        const eventNameEl = document.getElementById('in-eventName');
        const eventPlaceEl = document.getElementById('in-eventPlace');
        const placeGroupEl = document.getElementById('in-placeGroup');
        const memoEl = document.getElementById('in-memo');

        // 필수 항목 유효성 검사 (빈 칸이면 테두리 빨갛게 변경 후 포커스 이동)
        const inputs = [startYearEl, eventNameEl, eventPlaceEl, placeGroupEl];
        for (let input of inputs) {
            if (!input.value.trim()) {
                input.style.border = "2px solid #ff4d4d";
                input.focus();
                return;
            } else {
                input.style.border = "";
            }
        }

        const startYear = parseInt(startYearEl.value);
        const eventName = eventNameEl.value.trim();
        const eventPlace = eventPlaceEl.value.trim();
        const placeGroup = placeGroupEl.value;
        const memo = memoEl.value.trim();

        const newEvent = {
            eventID: Date.now(), // 고유 ID 생성
            userID: currentUserID,
            startYear,
            eventName,
            eventPlace,
            placeGroup,
            memo,
            upLink: null,
            leftLink: null
        };

        // 사건명 중복 검사
        const existing = events.find(e => e.eventName === eventName);
        if (existing) {
            app.selectEvent(existing.eventID); // 기존 사건이 있는 곳으로 화면 이동 및 선택
            
            // 기존 데이터와 완전히 같은지 검사
            const isSame = existing.startYear === startYear && existing.eventPlace === eventPlace && existing.placeGroup === placeGroup && existing.memo === memo;
            if (isSame) return; // 같으면 아무 일도 안 함

            if (confirm("기존 데이터와 다릅니다. 수정하시겠습니까?")) {
                Object.assign(existing, { startYear, eventPlace, placeGroup, memo });
                app.updateAllLinks();
                app.saveData();
                alert("수정되었습니다.");
            }
            return;
        }

        // 신규 추가일 경우
        events.push(newEvent);
        app.updateAllLinks();
        app.saveData();
        app.clearInputs();
        alert("새로운 사건이 등록되었습니다.");
    },

    // 6. 사건 삭제 로직
    deleteEvent: () => {
        if (!selectedID) {
            alert("삭제할 이벤트를 먼저 선택해주세요.");
            return;
        }

        if (confirm("정말 지울까요?")) {
            events = events.filter(e => e.eventID !== selectedID);
            selectedID = null;
            app.updateAllLinks();
            app.saveData();
            app.clearInputs();
            alert("삭제되었습니다.");
        }
    },

    // 7. Gemini AI 검색 연동 로직 (gemini-proxy.js 호출)
    fetchAI: async () => {
        const nameEl = document.getElementById('in-eventName');
        if (!nameEl.value.trim()) {
            nameEl.style.border = "2px solid #ff4d4d";
            nameEl.focus();
            alert("AI 검색을 위해 사건명을 입력해주세요.");
            return;
        }
        nameEl.style.border = "";

        alert("Gemini AI가 역사의 바다를 탐색 중입니다. 잠시만 기다려주세요...");

        try {
            const res = await fetch('/.netlify/functions/gemini-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventName: nameEl.value.trim() })
            });

            if (!res.ok) throw new Error("AI 프록시 서버 에러");
            const data = await res.json();

            // AI가 가져온 정보 입력창에 세팅 (이용자가 [추가] 버튼을 누를 수 있도록 유도)
            document.getElementById('in-startYear').value = data.startYear || "";
            document.getElementById('in-eventPlace').value = data.eventPlace || "";
            document.getElementById('in-placeGroup').value = data.placeGroup || "";
            document.getElementById('in-memo').value = data.memo || "";

            alert("AI 분석 완료! 내용을 확인하신 후 [추가 / 수정] 버튼을 누르면 정식 등록됩니다.");
        } catch (err) {
            console.error("AI 검색 실패:", err);
            alert("AI 검색 중 오류가 발생했습니다. 서버 설정을 확인하세요.");
        }
    },

    // 8. 검색 및 이름순 정렬 함수
    search: () => {
        const query = document.getElementById('in-eventName').value.toLowerCase().trim();
        if (!query) {
            alert("검색할 사건명을 입력해주세요.");
            return;
        }

        const results = events
            .filter(e => e.eventName.toLowerCase().includes(query))
            .sort((a, b) => a.eventName.localeCompare(b.eventName, 'ko')); // 가나다순 정렬

        const resDiv = document.getElementById('search-results');
        resDiv.innerHTML = '';
        resDiv.classList.toggle('hidden', results.length === 0);

        if (results.length === 0) {
            alert("검색 결과가 없습니다.");
            return;
        }

        results.forEach(ev => {
            const item = document.createElement('div');
            item.className = 'search-item';
            item.style.padding = '8px';
            item.style.borderBottom = '1px solid #555';
            item.style.cursor = 'pointer';
            const yearStr = ev.startYear < 0 ? `BC ${Math.abs(ev.startYear)}` : `AD ${ev.startYear}`;
            item.innerHTML = `<div style="display:flex; justify-content:space-between;"><span>${ev.eventName}</span><small style="color:#aaa;">${yearStr}</small></div>`;
            
            item.onclick = () => {
                app.selectEvent(ev.eventID);
                resDiv.classList.add('hidden'); // 클릭 시 결과 창 닫기
            };
            resDiv.appendChild(item);
        });
    },

    // 9. 이벤트 선택 및 화면 이동
    selectEvent: (id) => {
        selectedID = id;
        const ev = events.find(e => e.eventID === id);
        if (!ev) return;

        // 입력 폼에 선택된 데이터 채워주기
        document.getElementById('in-startYear').value = ev.startYear;
        document.getElementById('in-eventName').value = ev.eventName;
        document.getElementById('in-eventPlace').value = ev.eventPlace;
        document.getElementById('in-placeGroup').value = ev.placeGroup;
        document.getElementById('in-memo').value = ev.memo;

        app.render();
        
        // 대상 이벤트를 화면 정중앙으로 스크롤 스무스하게 이동
        const x = regions.indexOf(ev.placeGroup) * 200 + 100;
        const y = (ev.startYear + OFFSET_Y) * SCALE_Y;
        document.getElementById('content-body').scrollTo({ left: x - 400, top: y - 300, behavior: 'smooth' });

        // 메모 팝업 띄우기
        if (ev.memo) {
            setTimeout(() => { alert(`[메모 팝업]\n사건명: ${ev.eventName}\n\n내용: ${ev.memo}`); }, 300);
        }
    },

    // 10. 링크 관계성 업데이트 알고리즘
    updateAllLinks: () => {
        events.forEach(ev => {
            // UpLink: 동일 장소에서 바로 이전 시대 사건 찾기
            const samePlace = events
                .filter(e => e.eventPlace === ev.eventPlace && e.startYear < ev.startYear)
                .sort((a, b) => b.startYear - a.startYear);
            ev.upLink = samePlace.length > 0 ? samePlace[0].eventID : ev.eventID;

            // LeftLink: 동일 연도에서 본인보다 바로 한 칸 왼쪽 권역에 있는 사건 찾기
            const myRegionIdx = regions.indexOf(ev.placeGroup);
            const sameYear = events
                .filter(e => e.startYear === ev.startYear && regions.indexOf(e.placeGroup) < myRegionIdx)
                .sort((a, b) => regions.indexOf(b.placeGroup) - regions.indexOf(a.placeGroup));
            ev.leftLink = sameYear.length > 0 ? sameYear[0].eventID : ev.eventID;
        });
    },

    // 11. 화면 그리기 (렌더링) 및 SVG 연결선 생성
    render: () => {
        const container = document.getElementById('event-container');
        const svg = document.getElementById('link-layer');
        container.innerHTML = '';
        svg.innerHTML = '';

        events.forEach(ev => {
            // 노드 생성
            const node = document.createElement('div');
            node.className = `event-node ${selectedID === ev.eventID ? 'active' : ''}`;
            node.style.left = `${regions.indexOf(ev.placeGroup) * 200 + 30}px`;
            node.style.top = `${(ev.startYear + OFFSET_Y) * SCALE_Y}px`;
            node.innerText = ev.eventName;
            node.onclick = () => app.selectEvent(ev.eventID);
            container.appendChild(node);

            // 선택된 노드의 선만 그리도록 규정 (선 하이라이트 기능 구현)
            if (selectedID === ev.eventID) {
                if (ev.upLink && ev.upLink !== ev.eventID) {
                    const prev = events.find(e => e.eventID === ev.upLink);
                    if (prev) app.createSVGLine(ev, prev, "blue");
                }
                if (ev.leftLink && ev.leftLink !== ev.eventID) {
                    const left = events.find(e => e.eventID === ev.leftLink);
                    if (left) app.createSVGLine(ev, left, "red");
                }
            }
        });
    },
    
    createSVGLine: (e1, e2, color) => {
        const svg = document.getElementById('link-layer');
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        const getX = (ev) => regions.indexOf(ev.placeGroup) * 200 + 100;
        const getY = (ev) => (ev.startYear + OFFSET_Y) * SCALE_Y + 20;

        line.setAttribute("x1", getX(e1)); line.setAttribute("y1", getY(e1));
        line.setAttribute("x2", getX(e2)); line.setAttribute("y2", getY(e2));
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", "3");
        if (color === "red") line.setAttribute("stroke-dasharray", "5,5"); // 좌우 공간 연결은 점선 처리
        svg.appendChild(line);
    },

    clearInputs: () => {
        document.getElementById('in-startYear').value = '';
        document.getElementById('in-eventName').value = '';
        document.getElementById('in-eventPlace').value = '';
        document.getElementById('in-placeGroup').value = '';
        document.getElementById('in-memo').value = '';
    }
};

// ==========================================
// 브라우저 이벤트 리스너 바인딩 (메시지 맵 방식)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 버튼 기능 연결
    document.getElementById('btn-login-submit')?.addEventListener('click', app.login);
    document.getElementById('btn-add')?.addEventListener('click', app.addEvent);
    document.getElementById('btn-search')?.addEventListener('click', app.search);
    document.getElementById('btn-ai')?.addEventListener('click', app.fetchAI);
    document.getElementById('btn-delete')?.addEventListener('click', app.deleteEvent);

    // 화살표 커서 키를 이용한 흐름 이동 제어 기능
    document.addEventListener('keydown', (e) => {
        if (!selectedID) return;
        const current = events.find(ev => ev.eventID === selectedID);
        if (!current) return;

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (current.upLink && current.upLink !== selectedID) app.selectEvent(current.upLink);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (current.leftLink && current.leftLink !== selectedID) app.selectEvent(current.leftLink);
        }
    });
});
