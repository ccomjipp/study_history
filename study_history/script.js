// ==========================================
// [이음이 역사 공부] 프론트엔드 핵심 로직 (동적 시공간 축 고도화)
// ==========================================

const ALL_REGIONS = ["한국", "일본", "중국", "동남아시아", "서남아시아", "중앙아시아", "중동", "유럽", "아프리카", "북미", "남미", "기타"];
const SCALE_Y = 10;     // 1년당 세로 폭 (10px)
const OFFSET_Y = 3000;  // 기원전(BC) 3000년을 좌표계의 0점으로 설정

let events = [];        // 역사 사건 데이터 배열
let selectedID = null;  // 선택된 이벤트 ID
let currentUserID = ""; // 로그인 성공 사용자 ID

window.app = {
    // 1. 로그인 검증 함수
    login: async () => {
        const userID = document.getElementById('login-id').value.trim();
        const password = document.getElementById('login-pw').value.trim();

        if (!userID || !password) {
            alert("ID와 비밀번호를 모두 입력해주세요.");
            return;
        }

        try {
            const res = await fetch('/.netlify/functions/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userID, password })
            });

            const result = await res.json();

            if (res.ok && result.success) {
                currentUserID = userID;
                document.getElementById('login-overlay').style.display = 'none';
                document.getElementById('app-container').style.display = 'flex';
                
                app.init();
                await app.loadData();
            } else {
                alert(result.message || "로그인 정보가 올바르지 않습니다.");
            }
        } catch (err) {
            console.error("로그인 통신 에러:", err);
            alert("서버와 통신 중 오류가 발생했습니다.");
        }
    },

    // 2. 초기 UI 컴포넌트 바인딩 (입력 선택지는 전체 권역을 유지하여 신규 입력 보장)
    init: () => {
        const select = document.getElementById('in-placeGroup');
        select.innerHTML = '<option value="">권역 선택 (필수)</option>';
        ALL_REGIONS.forEach(r => {
            select.innerHTML += `<option value="${r}">${r}</option>`;
        });
    },

    // 3. 백엔드 데이터 불러오기 (예외 처리 강화로 배열 붕괴 차단)
    loadData: async () => {
        try {
            const res = await fetch(`/.netlify/functions/data?userID=${currentUserID}`);
            if (res.ok) {
                const data = await res.json();
                // 🎯 [버그 수정] 반환 값이 배열인지 엄격히 검증하여 함수 크래시 원천 차단
                events = Array.isArray(data) ? data : []; 
            } else {
                events = [];
            }
        } catch (err) {
            console.error("데이터 로드 실패:", err);
            events = [];
        }
        app.render();
    },

    // 4. 백엔드 데이터 저장하기
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
            eventID: Date.now(),
            userID: currentUserID,
            startYear,
            eventName,
            eventPlace,
            placeGroup,
            memo,
            upLink: null,
            leftLink: null
        };

        // 데이터가 깨져 배열이 아닐 경우를 대비한 방어 코드
        if (!Array.isArray(events)) events = [];

        const existing = events.find(e => e.eventName === eventName);
        if (existing) {
            app.selectEvent(existing.eventID);
            
            const isSame = existing.startYear === startYear && existing.eventPlace === eventPlace && existing.placeGroup === placeGroup && existing.memo === memo;
            if (isSame) return;

            if (confirm("기존 데이터와 다릅니다. 수정하시겠습니까?")) {
                Object.assign(existing, { startYear, eventPlace, placeGroup, memo });
                app.updateAllLinks();
                app.saveData();
                alert("수정되었습니다.");
            }
            return;
        }

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

    // 7. Gemini AI 검색 연동
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

            document.getElementById('in-startYear').value = data.startYear || "";
            document.getElementById('in-eventPlace').value = data.eventPlace || "";
            document.getElementById('in-placeGroup').value = data.placeGroup || "";
            document.getElementById('in-memo').value = data.memo || "";

            alert("AI 분석 완료! 내용을 확인하신 후 [추가 / 수정] 버튼을 누르면 정식 등록됩니다.");
        } catch (err) {
            console.error("AI 검색 실패:", err);
            alert("AI 검색 중 오류가 발생했습니다.");
        }
    },

    // 8. 검색 및 이름순 정렬
    search: () => {
        const query = document.getElementById('in-eventName').value.toLowerCase().trim();
        if (!query) {
            alert("검색할 사건명을 입력해주세요.");
            return;
        }

        const results = events
            .filter(e => e.eventName.toLowerCase().includes(query))
            .sort((a, b) => a.eventName.localeCompare(b.eventName, 'ko'));

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
                resDiv.classList.add('hidden');
            };
            resDiv.appendChild(item);
        });
    },

    // 9. 이벤트 선택 및 화면 이동 (동적 가상의 축 좌표 대응 계산)
    selectEvent: (id) => {
        selectedID = id;
        const ev = events.find(e => e.eventID === id);
        if (!ev) return;

        document.getElementById('in-startYear').value = ev.startYear;
        document.getElementById('in-eventName').value = ev.eventName;
        document.getElementById('in-eventPlace').value = ev.eventPlace;
        document.getElementById('in-placeGroup').value = ev.placeGroup;
        document.getElementById('in-memo').value = ev.memo;

        app.render();
        
        // 🎯 [동적 좌표 보정] 활성화된 권역 배열 기준으로 가로 스크롤 위치 계산
        const activeRegions = ALL_REGIONS.filter(r => events.some(e => e.placeGroup === r));
        const regionIdx = activeRegions.indexOf(ev.placeGroup);
        
        const x = regionIdx * 200 + 100;
        const y = (ev.startYear + OFFSET_Y) * SCALE_Y;
        document.getElementById('content-body').scrollTo({ left: x - 400, top: y - 300, behavior: 'smooth' });
    },

    // 10. 관계성 링크 업데이트
    updateAllLinks: () => {
        events.forEach(ev => {
            const samePlace = events
                .filter(e => e.eventPlace === ev.eventPlace && e.startYear < ev.startYear)
                .sort((a, b) => b.startYear - a.startYear);
            ev.upLink = samePlace.length > 0 ? samePlace[0].eventID : ev.eventID;

            const myRegionIdx = ALL_REGIONS.indexOf(ev.placeGroup);
            const sameYear = events
                .filter(e => e.startYear === ev.startYear && ALL_REGIONS.indexOf(e.placeGroup) < myRegionIdx)
                .sort((a, b) => ALL_REGIONS.indexOf(b.placeGroup) - ALL_REGIONS.indexOf(a.placeGroup));
            ev.leftLink = sameYear.length > 0 ? sameYear[0].eventID : ev.eventID;
        });
    },

    // 11. 화면 렌더링 및 동적 시공간 매트릭스 압축 정렬
    render: () => {
        const container = document.getElementById('event-container');
        const svg = document.getElementById('link-layer');
        const ruler = document.getElementById('year-ruler');
        const header = document.getElementById('region-header');
        
        container.innerHTML = '';
        svg.innerHTML = '';
        ruler.innerHTML = '';
        header.innerHTML = ''; // 🎯 상단 권역 축 헤더 초기화

        if (!Array.isArray(events) || events.length === 0) {
            document.getElementById('timeline-grid').style.width = "100%";
            return;
        }

        // 🎯 [핵심 기법] 데이터가 존재하는 권역(Active Regions)만 순서대로 추출
        const activeRegions = ALL_REGIONS.filter(r => events.some(e => e.placeGroup === r));

        // [A] 권역축 동적 생성: 이벤트가 있는 권역만 상단에 렌더링
        activeRegions.forEach(r => {
            header.innerHTML += `<div class="region-label" style="min-width:200px; text-align:center; line-height:40px; border-right:1px solid #555;">${r}</div>`;
        });

        // 🎯 활성화된 권역 수에 맞춰 대지(Grid)의 가로폭을 축소/조절
        const gridWidth = activeRegions.length * 200;
        document.getElementById('timeline-grid').style.width = `${gridWidth}px`;

        // [B] 연도축 동적 생성: 입력된 이벤트 연도만 표시 (기존 유지)
        const uniqueYears = [...new Set(events.map(e => e.startYear))].sort((a, b) => a - b);
        uniqueYears.forEach(y => {
            const label = document.createElement('div');
            label.className = 'year-label';
            label.style.position = 'absolute';
            label.style.width = '100%';
            label.style.textAlign = 'right';
            label.style.paddingRight = '12px';
            label.style.fontSize = '12px';
            label.style.fontWeight = 'bold';
            label.style.top = `${(y + OFFSET_Y) * SCALE_Y + 20}px`; 
            
            const isSelectedYear = events.find(e => e.eventID === selectedID)?.startYear === y;
            if (isSelectedYear) {
                label.style.color = '#3498db';
                label.style.fontSize = '14px';
            } else {
                label.style.color = '#7f8c8d';
            }
            
            label.innerText = y < 0 ? `BC ${Math.abs(y)}` : `AD ${y}`;
            ruler.appendChild(label);
        });

        // [C] 이벤트 노드 배치 및 가로/세로 압축 가이드라인 투사
        events.forEach(ev => {
            const regionIdx = activeRegions.indexOf(ev.placeGroup);
            if (regionIdx === -1) return; // 활성화되지 않은 권역 예외 처리

            // 노드 배치 좌표를 activeRegions 인덱스 기반으로 전면 수정
            const node = document.createElement('div');
            node.className = `event-node ${selectedID === ev.eventID ? 'active' : ''}`;
            node.style.left = `${regionIdx * 200 + 25}px`;
            node.style.top = `${(ev.startYear + OFFSET_Y) * SCALE_Y}px`;
            node.innerText = ev.eventName;
            node.onclick = () => app.selectEvent(ev.eventID);
            container.appendChild(node);

            // 가이드라인 좌표 계산식 구조 정의
            const getX = (e) => activeRegions.indexOf(e.placeGroup) * 200 + 100;
            const getY = (e) => (e.startYear + OFFSET_Y) * SCALE_Y + 20;
            
            const isSelected = selectedID === ev.eventID;
            const strokeColor = isSelected ? "#3498db" : "#e0e0e0";
            const strokeWidth = isSelected ? "2" : "1";
            const dashArray = isSelected ? "0" : "4,4";
            const opacity = isSelected ? "1" : "0.6";

            // 가로축 투사 (폭을 고정이 아닌 동적 gridWidth 값에 완벽 매핑)
            const hLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            hLine.setAttribute("x1", "0"); hLine.setAttribute("y1", getY(ev));
            hLine.setAttribute("x2", gridWidth.toString()); hLine.setAttribute("y2", getY(ev));
            hLine.setAttribute("stroke", strokeColor);
            hLine.setAttribute("stroke-width", strokeWidth);
            hLine.setAttribute("stroke-dasharray", dashArray);
            hLine.setAttribute("opacity", opacity);
            svg.appendChild(hLine);

            // 세로축 투사
            const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            vLine.setAttribute("x1", getX(ev)); vLine.setAttribute("y1", "0");
            vLine.setAttribute("x2", getX(ev)); vLine.setAttribute("y2", getY(ev));
            vLine.setAttribute("stroke", strokeColor);
            vLine.setAttribute("stroke-width", strokeWidth);
            vLine.setAttribute("stroke-dasharray", dashArray);
            vLine.setAttribute("opacity", opacity);
            svg.appendChild(vLine);

            // 인과관계 연결선 덧씌우기
            if (isSelected) {
                if (ev.upLink && ev.upLink !== ev.eventID) {
                    const prev = events.find(e => e.eventID === ev.upLink);
                    if (prev && activeRegions.includes(prev.placeGroup)) {
                        app.createSVGLine(getX(ev), getY(ev), getX(prev), getY(prev), "#2980b9", "3", "0");
                    }
                }
                if (ev.leftLink && ev.leftLink !== ev.eventID) {
                    const left = events.find(e => e.eventID === ev.leftLink);
                    if (left && activeRegions.includes(left.placeGroup)) {
                        app.createSVGLine(getX(ev), getY(ev), getX(left), getY(left), "#e74c3c", "3", "5,5");
                    }
                }
            }
        });
    },
    
    // 유틸리티: 관계성 라인 기본 렌더러
    createSVGLine: (x1, y1, x2, y2, color, width, dash) => {
        const svg = document.getElementById('link-layer');
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");

        line.setAttribute("x1", x1); line.setAttribute("y1", y1);
        line.setAttribute("x2", x2); line.setAttribute("y2", y2);
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", width);
        if (dash !== "0") line.setAttribute("stroke-dasharray", dash);
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
// 시스템 이벤트 핸들러 초기 가동
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-login-submit')?.addEventListener('click', app.login);
    document.getElementById('btn-add')?.addEventListener('click', app.addEvent);
    document.getElementById('btn-search')?.addEventListener('click', app.search);
    document.getElementById('btn-ai')?.addEventListener('click', app.fetchAI);
    document.getElementById('btn-delete')?.addEventListener('click', app.deleteEvent);

    // 방향키 커서 제어 스코프 바인딩
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
