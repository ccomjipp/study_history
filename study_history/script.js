// ==========================================
// [이음이 역사 공부] 프론트엔드 핵심 로직 (통합 완결판)
// ==========================================

const ALL_REGIONS = ["한국", "일본", "중국", "동남아시아", "서남아시아", "중앙아시아", "중동", "유럽", "아프리카", "북미", "남미", "기타"];
const CARD_GAP = 38;    // 카드가 빈틈없이 붙도록 최적화된 마진 간격

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
                sessionStorage.setItem("yieumi_user", userID); 
                
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

    // 2. 초기 UI 바인딩
    init: () => {
        const select = document.getElementById('in-placeGroup');
        select.innerHTML = '<option value="">권역 선택 (필수)</option>';
        ALL_REGIONS.forEach(r => {
            select.innerHTML += `<option value="${r}">${r}</option>`;
        });
    },

    // 3. 백엔드 데이터 불러오기
    loadData: async () => {
        try {
            const res = await fetch(`/.netlify/functions/data?userID=${currentUserID}`);
            if (res.ok) {
                const data = await res.json();
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
            const res = await fetch(`/.netlify/functions/data?userID=${currentUserID}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(events)
            });

            if (!res.ok) throw new Error(`서버 응답 에러 (Status: ${res.status})`);
            app.render();
        } catch (err) {
            console.error("데이터 저장 실패:", err);
            alert("⚠️ 경고: 데이터가 Netlify 서버에 저장되지 못했습니다!");
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

        if (!Array.isArray(events)) events = [];

        const existing = events.find(e => e.eventName === eventName && e.startYear === startYear && e.placeGroup === placeGroup);
        if (existing) {
            app.selectEvent(existing.eventID);
            
            const isSame = existing.eventPlace === eventPlace && existing.memo === memo;
            if (isSame) return;

            if (confirm("동일 시공간에 같은 이름의 사건이 있습니다. 수정하시겠습니까?")) {
                Object.assign(existing, { eventPlace, memo });
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

    // 7. 브라우저 직접 호출 방식의 Gemini AI 검색 (UI에선 버튼을 주석 처리했으나 기능은 유지)
    fetchAI: async () => {
        const nameEl = document.getElementById('in-eventName');
        if (!nameEl.value.trim()) {
            nameEl.style.border = "2px solid #ff4d4d";
            nameEl.focus();
            alert("AI 검색을 위해 사건명을 입력해주세요.");
            return;
        }
        nameEl.style.border = "";

        let localKey = localStorage.getItem("my_gemini_key");
        if (!localKey) {
            localKey = prompt("🔒 구글 AI Studio에서 발급받은 API 키를 입력해주세요.");
            if (!localKey) return;
            localStorage.setItem("my_gemini_key", localKey.trim());
        }

        alert("Gemini AI가 탐색 중입니다...");

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${localKey}`;
            const promptText = `역사 사건 "${nameEl.value.trim()}"에 대해 조사해서 JSON 형식으로만 답변해줘.`;

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
            });

            if (!res.ok) {
                if (res.status === 400 || res.status === 401) localStorage.removeItem("my_gemini_key");
                throw new Error(`구글 서버 에러 (${res.status})`);
            }

            const rawData = await res.json();
            let text = rawData.candidates[0].content.parts[0].text.trim();
            if (text.startsWith("```")) text = text.replace(/```json|```/g, "").trim();

            const data = JSON.parse(text);
            document.getElementById('in-startYear').value = data.startYear || "";
            document.getElementById('in-eventPlace').value = data.eventPlace || "";
            document.getElementById('in-placeGroup').value = data.placeGroup || "";
            document.getElementById('in-memo').value = data.memo || "";

            alert("AI 분석 완료!");
        } catch (err) {
            alert(`AI 검색 오류: ${err.message}`);
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

    // 9. 이벤트 선택 및 화면 이동
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
        
        const activeRegions = ALL_REGIONS.filter(r => events.some(e => e.placeGroup === r));
        const regionIdx = activeRegions.indexOf(ev.placeGroup);
        const uniqueYears = [...new Set(events.map(e => e.startYear))].sort((a, b) => a - b);

        const yearTops = {};
        let currentTop = 20;
        uniqueYears.forEach(y => {
            yearTops[y] = currentTop;
            const maxEventsInAnyRegion = Math.max(...activeRegions.map(r => events.filter(e => e.startYear === y && e.placeGroup === r).length), 1);
            currentTop += (maxEventsInAnyRegion * CARD_GAP) + 20;
        });

        const sameCellEvents = events.filter(e => e.startYear === ev.startYear && e.placeGroup === ev.placeGroup);
        const stackIdx = sameCellEvents.findIndex(e => e.eventID === ev.eventID);
        
        const x = regionIdx * 200 + 100;
        const y = yearTops[ev.startYear] + (stackIdx * CARD_GAP) + 20; 
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

    // 11. 화면 렌더링
    render: () => {
        const container = document.getElementById('event-container');
        const svg = document.getElementById('link-layer');
        const ruler = document.getElementById('year-ruler');
        const header = document.getElementById('region-header');
        
        container.innerHTML = '';
        svg.innerHTML = '';
        ruler.innerHTML = '';
        header.innerHTML = ''; 

        if (!Array.isArray(events) || events.length === 0) {
            document.getElementById('timeline-grid').style.width = "100%";
            document.getElementById('timeline-grid').style.height = "100%";
            return;
        }

        const activeRegions = ALL_REGIONS.filter(r => events.some(e => e.placeGroup === r));
        activeRegions.forEach(r => {
            header.innerHTML += `<div class="region-label">${r}</div>`;
        });
        const gridWidth = activeRegions.length * 200;
        document.getElementById('timeline-grid').style.width = `${gridWidth}px`;
        
        // 🎯 [구조 개혁] 강제로 전체 가로 길이를 주입하던 명령을 제거하여, 뷰포트 영역 내부 클리핑 작동 유도

        const uniqueYears = [...new Set(events.map(e => e.startYear))].sort((a, b) => a - b);
        
        const yearTops = {};
        let currentTop = 20;

        uniqueYears.forEach(y => {
            yearTops[y] = currentTop;
            const maxEventsInAnyRegion = Math.max(
                ...activeRegions.map(r => events.filter(e => e.startYear === y && e.placeGroup === r).length),
                1
            );
            currentTop += (maxEventsInAnyRegion * CARD_GAP) + 20;
        });

        document.getElementById('timeline-grid').style.height = `${currentTop + 60}px`;

        uniqueYears.forEach(y => {
            const label = document.createElement('div');
            label.className = 'year-label';
            label.style.position = 'absolute';
            label.style.width = '100%';
            label.style.textAlign = 'right';
            label.style.paddingRight = '12px';
            label.style.fontWeight = 'bold';
            
            label.style.top = `${yearTops[y]}px`; 
            label.style.paddingTop = '10px'; 
            label.style.fontSize = '13px';
            label.style.transform = 'none'; 
            
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

        const cellCounters = {}; 

        events.forEach(ev => {
            const regionIdx = activeRegions.indexOf(ev.placeGroup);
            const yearIdx = uniqueYears.indexOf(ev.startYear);
            if (regionIdx === -1 || yearIdx === -1) return; 

            const cellKey = `${ev.startYear}-${ev.placeGroup}`;
            if (!cellCounters[cellKey]) cellCounters[cellKey] = 0;
            const stackIdx = cellCounters[cellKey];
            cellCounters[cellKey]++;

            const node = document.createElement('div');
            node.className = `event-node ${selectedID === ev.eventID ? 'active' : ''}`;
            node.style.left = `${regionIdx * 200 + 25}px`;
            node.style.top = `${yearTops[ev.startYear] + (stackIdx * CARD_GAP)}px`;
            node.innerText = ev.eventName;
            node.onclick = () => app.selectEvent(ev.eventID);

            if (ev.memo && ev.memo.trim() !== "") {
                const tooltip = document.createElement('div');
                tooltip.className = 'memo-tooltip';
                tooltip.innerText = ev.memo;
                node.appendChild(tooltip); 
            }
            
            container.appendChild(node);

            const getX = (e) => activeRegions.indexOf(e.placeGroup) * 200 + 100;
            const getY = (e) => yearTops[ev.startYear] + (stackIdx * CARD_GAP) + 18; 
            
            const isSelected = selectedID === ev.eventID;
            const strokeColor = isSelected ? "#3498db" : "#e0e0e0";
            const strokeWidth = isSelected ? "2" : "1";
            const dashArray = isSelected ? "0" : "4,4";
            const opacity = isSelected ? "1" : "0.6";

            const hLine = document.createElementNS("[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)", "line");
            hLine.setAttribute("x1", "0"); hLine.setAttribute("y1", getY(ev));
            hLine.setAttribute("x2", gridWidth.toString()); hLine.setAttribute("y2", getY(ev));
            hLine.setAttribute("stroke", strokeColor);
            hLine.setAttribute("stroke-width", strokeWidth);
            hLine.setAttribute("stroke-dasharray", dashArray);
            hLine.setAttribute("opacity", opacity);
            svg.appendChild(hLine);

            const vLine = document.createElementNS("[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)", "line");
            vLine.setAttribute("x1", getX(ev)); vLine.setAttribute("y1", "0");
            vLine.setAttribute("x2", getX(ev)); vLine.setAttribute("y2", getY(ev));
            vLine.setAttribute("stroke", strokeColor);
            vLine.setAttribute("stroke-width", strokeWidth);
            vLine.setAttribute("stroke-dasharray", dashArray);
            vLine.setAttribute("opacity", opacity);
            svg.appendChild(vLine);

            if (isSelected) {
                const getLinkX = (e) => activeRegions.indexOf(e.placeGroup) * 200 + 100;
                const getLinkY = (e) => {
                    const sEvents = events.filter(evnt => evnt.startYear === e.startYear && evnt.placeGroup === e.placeGroup);
                    const sIdx = sEvents.findIndex(evnt => evnt.eventID === e.eventID);
                    return yearTops[e.startYear] + (sIdx * CARD_GAP) + 18;
                };

                if (ev.upLink && ev.upLink !== ev.eventID) {
                    const prev = events.find(e => e.eventID === ev.upLink);
                    if (prev && activeRegions.includes(prev.placeGroup)) {
                        app.createSVGLine(getLinkX(ev), getLinkY(ev), getLinkX(prev), getLinkY(prev), "#2980b9", "3", "0");
                    }
                }
                if (ev.leftLink && ev.leftLink !== ev.eventID) {
                    const left = events.find(e => e.eventID === ev.leftLink);
                    if (left && activeRegions.includes(left.placeGroup)) {
                        app.createSVGLine(getLinkX(ev), getLinkY(ev), getLinkX(left), getLinkY(left), "#e74c3c", "3", "5,5");
                    }
                }
            }
        });
        
        // 🎯 [마지막 연산 버스트] 렌더링 직후 현재 하단 스크롤 위치를 상단 헤더에 즉각 동기화 주입
        header.scrollLeft = contentBody.scrollLeft;
    },
    
    createSVGLine: (x1, y1, x2, y2, color, width, dash) => {
        const svg = document.getElementById('link-layer');
        const line = document.createElementNS("[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)", "line");

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
// 시스템 최초 부트 리스너
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-login-submit')?.addEventListener('click', app.login);
    document.getElementById('btn-add')?.addEventListener('click', app.addEvent);
    document.getElementById('btn-search')?.addEventListener('click', app.search);
    document.getElementById('btn-delete')?.addEventListener('click', app.deleteEvent);

    const contentBody = document.getElementById('content-body');
    const regionHeader = document.getElementById('region-header');

    if (contentBody && regionHeader) {
        contentBody.addEventListener('scroll', () => {
            // 🎯 [아키텍처 혁신] 하단 본문의 좌우 스크롤바 이동거리(scrollLeft) 값을 
            // 상단 헤더의 내부 스크롤바 위치에 1:1 직결 동기화! (오버플로우 네이티브 픽셀 매칭)
            regionHeader.scrollLeft = contentBody.scrollLeft;
        });
    }
    
    document.getElementById('content-body')?.addEventListener('click', (e) => {
        if (selectedID && !e.target.closest('.event-node')) {
            selectedID = null;         
            app.clearInputs();         
            app.render();              
        }
    });

    const savedUser = sessionStorage.getItem("yieumi_user");
    if (savedUser) {
        currentUserID = savedUser;
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        app.init();
        app.loadData(); 
    }

    document.addEventListener('keydown', (e) => {
        if (!selectedID) return;
        const current = events.find(ev => ev.eventID === selectedID);
        if (!current) return;

        const activeRegions = ALL_REGIONS.filter(r => events.some(e => e.placeGroup === r));
        const uniqueYears = [...new Set(events.map(e => e.startYear))].sort((a, b) => a - b);
        
        const rIdx = activeRegions.indexOf(current.placeGroup);
        const yIdx = uniqueYears.indexOf(current.startYear);
        const sameCell = events.filter(ev => ev.startYear === current.startYear && ev.placeGroup === current.placeGroup);
        const stackIdx = sameCell.findIndex(ev => ev.eventID === selectedID);

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (stackIdx > 0) {
                app.selectEvent(sameCell[stackIdx - 1].eventID);
            } else {
                for (let i = yIdx - 1; i >= 0; i--) {
                    const targets = events.filter(ev => ev.startYear === uniqueYears[i] && ev.placeGroup === current.placeGroup);
                    if (targets.length > 0) {
                        app.selectEvent(targets[targets.length - 1].eventID);
                        break;
                    }
                }
            }
        } 
        else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (stackIdx < sameCell.length - 1) {
                app.selectEvent(sameCell[stackIdx + 1].eventID);
            } else {
                for (let i = yIdx + 1; i < uniqueYears.length; i++) {
                    const targets = events.filter(ev => ev.startYear === uniqueYears[i] && ev.placeGroup === current.placeGroup);
                    if (targets.length > 0) {
                        app.selectEvent(targets[0].eventID);
                        break;
                    }
                }
            }
        } 
        else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            for (let i = rIdx - 1; i >= 0; i--) {
                const targets = events.filter(ev => ev.startYear === current.startYear && ev.placeGroup === activeRegions[i]);
                if (targets.length > 0) {
                    app.selectEvent(targets[0].eventID);
                    break;
                }
            }
        } 
        else if (e.key === 'ArrowRight') {
            e.preventDefault();
            for (let i = rIdx + 1; i < activeRegions.length; i++) {
                const targets = events.filter(ev => ev.startYear === current.startYear && ev.placeGroup === activeRegions[i]);
                if (targets.length > 0) {
                    app.selectEvent(targets[0].eventID);
                    break;
                }
            }
        }
    });
});