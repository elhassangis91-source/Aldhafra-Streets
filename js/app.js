// 1. تعريف الطبقات المختلفة (Base Maps)
const googleStreets = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: 'Google Maps'
});

const googleSatellite = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: 'Google Satellite'
});

const googleHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: 'Google Hybrid'
});

// 2. إنشاء الخريطة مع الطبقة الافتراضية (Streets)
const map = L.map('map', {
    center: [23.65, 53.70],
    zoom: 9,
    layers: [googleStreets] // الطبقة اللي بتبدأ أول ما تفتح
});

// 3. تجهيز القائمة اللي هتظهر في الزرار
const baseMaps = {
    "خريطة جوجل": googleStreets,
    "صور الأقمار الصناعية": googleSatellite,
    "خريطة هجينة": googleHybrid
};

// 4. إضافة الزرار في جهة اليسار (Top Left)
L.control.layers(baseMaps, null, { position: 'topleft' }).addTo(map);

let allStreetsLayer, geojsonData, lastSelectedStreet = null;
let lastFilteredReportData = []; // تخزين بيانات التقرير المفلترة
let awaitingExportConfirmation = false; // حالة انتظار تأكيد الحفظ

// 2. دوال النظام الأساسية (التبويبات ومعالجة النصوص)
window.openTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) selectedTab.classList.add('active');
    if (window.event && window.event.currentTarget) window.event.currentTarget.classList.add('active');
}

const normalizeArabic = (text) => {
    if (!text) return "";
    return String(text)
        .replace(/[\u064B-\u0652]/g, "") // حذف التشكيل
        .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
        .replace(/\s+/g, " ").trim().toLowerCase();
};

// 3. تحميل البيانات وتنسيق الخريطة
fetch('data/AllStreets.json').then(r => r.json()).then(data => {
    geojsonData = data;
    allStreetsLayer = L.geoJSON(data, {
        onEachFeature: function(feature, layer) {
            const props = feature.properties;
            const status = props.Status || "غير محدد";
            let statusColor = status.includes("غير منفذ") ? "#e67e22" : (status.includes("منفذ") ? "#27ae60" : "#34495e");

            layer.setStyle({ color: "#1a2a6c", weight: 60, opacity: 0 });
            const vLine = L.polyline(layer.getLatLngs(), { color: "#1a2a6c", weight: 1.5, opacity: 0.5, interactive: false }).addTo(map);
            layer.visibleLine = vLine;

            const popupHTML = `
                <div style="direction:rtl; text-align:right; font-family: 'Tajawal', sans-serif;">
                    <strong style="font-size:16px; color:#2c3e50;">${props.Name_Ar || 'غير مسمى'}</strong><br>
                    <span style="font-size:13px; color:#95a5a6;">${props.Name_En || ''}</span><hr style="margin:8px 0;">
                    <b>المنطقة الجغرافية:</b> ${props.DistrictName_Arabic || '-'}<br>
                    <b>حالة تنفيذ اللوحات:</b> <span style="color:${statusColor}; font-weight:bold;">${status}</span>
                </div>`;
            layer.bindPopup(popupHTML);
            layer.on('click', () => { highlightStreet(layer); lastSelectedStreet = feature; });
        }
    }).addTo(map);
    renderList(data.features);
});

// 4. وظائف التفاعل (التمييز وحساب الأطوال)
function highlightStreet(layer) {
    allStreetsLayer.eachLayer(l => { if (l.visibleLine) l.visibleLine.setStyle({ color: "#1a2a6c", weight: 1.5, opacity: 0.5 }); });
    if (layer.visibleLine) { layer.visibleLine.setStyle({ color: "#ff0000", weight: 8, opacity: 1 }).bringToFront(); }
    layer.openPopup();
}

function calculateFixedLength(name) {
    const segments = geojsonData.features.filter(f => normalizeArabic(f.properties.Name_Ar) === normalizeArabic(name));
    if (segments.length === 0) return 0;
    let rawTotal = 0;
    segments.forEach(seg => {
        const coords = seg.geometry.coordinates;
        if (seg.geometry.type === "LineString") {
            for (let i = 0; i < coords.length - 1; i++) rawTotal += L.latLng(coords[i][1], coords[i][0]).distanceTo(L.latLng(coords[i+1][1], coords[i+1][0]));
        } else if (seg.geometry.type === "MultiLineString") {
            coords.forEach(line => { for (let i = 0; i < line.length - 1; i++) rawTotal += L.latLng(line[i][1], line[i][0]).distanceTo(L.latLng(line[i+1][1], line[i+1][0])); });
        }
    });
    return rawTotal;
}

// 5. محرك الذكاء الاصطناعي (المطور لدعم المدن المتعددة والبحث الذكي)
function processAI(query) {
    const qNorm = normalizeArabic(query);
    const qText = qNorm.replace(/[؟?]/g, "");

    // أ. التحقق من رد التأكيد للحفظ (PDF/Excel)
    const positiveReplies = ["نعم", "ايوه", "اجل", "طبعا", "حفظ", "اوكي", "تصدير", "اطبع"];
    if (awaitingExportConfirmation && positiveReplies.some(word => qText.includes(word))) {
        awaitingExportConfirmation = false;
        showExportModal();
        return;
    } else if (awaitingExportConfirmation) {
        awaitingExportConfirmation = false;
    }

    // ب. نظام الإحصائيات (دعم الأعيان + المدن + الحالات)
    const isReportRequested = qText.includes("تقرير") || qText.includes("اطبع") || qText.includes("حفظ");
    const isAyanQuery = qText.includes("اعيان") || qText.includes("الاعيان"); // التعرف على مسمى الأعيان

    if (qText.includes("عدد") || qText.includes("احصائ") || qText.includes("اسماء") || qText.includes("كم") || qText.includes("شوارع") || qText.includes("طرق") || qText.includes("كم شارع") || isReportRequested) {
        const districts = [...new Set(geojsonData.features.map(f => f.properties.DistrictName_Arabic).filter(Boolean))];
        let targetDistricts = [];

        // التعرف على المدن المذكورة
        districts.forEach(d => {
            const coreName = normalizeArabic(d).replace(/\b(منطقه|مدينه)\b/g, "").trim();
            if (coreName && qText.includes(coreName)) targetDistricts.push(d);
        });

        // التعرف على الحالة (منفذ / تم التنفيذ / لم تنفذ / إلخ)
        let targetStatus = null;

        // التحقق من وجود نفي (لم، غير) أو كلمات تدل على عدم التنفيذ
        const isNegative = qText.includes("غير") || qText.includes("لم");

        // التحقق مما إذا كان النص يحتوي على أصل كلمة "نفذ"
        if (qText.includes("منفذ") || qText.includes("تنفيذ") || qText.includes("تنفذ")) {
        targetStatus = isNegative ? "غير منفذ" : "منفذ";
        }

        // تنفيذ الفلترة
        let filteredData = geojsonData.features;

        // 1. فلترة الأعيان بناءً على الحقل RoadClassNew
        if (isAyanQuery) {
            filteredData = filteredData.filter(f => String(f.properties.RoadClassNew) === "2");
        }
        // 2. فلترة المدن
        if (targetDistricts.length > 0) {
            filteredData = filteredData.filter(f => targetDistricts.includes(f.properties.DistrictName_Arabic));
        }
        // 3. فلترة الحالة
        if (targetStatus) {
            filteredData = filteredData.filter(f => {
                const status = f.properties.Status || "";
                return targetStatus === "غير منفذ" ? status.includes("غير منفذ") : (status.includes("منفذ") && !status.includes("غير منفذ"));
            });
        }

        // تحضير بيانات التقرير (نفس الأعمدة الأصلية دون تغيير)
        lastFilteredReportData = filteredData.map(f => ({
            "الرقم التعريفي": f.properties.RoadID || "-",
            "الاسم العربي": f.properties.Name_Ar || "-",
            "المنطقة": f.properties.DistrictName_Arabic || "-",
            "الحالة": f.properties.Status || "-"
        }));

        const count = filteredData.length;
        let ayanLabel = isAyanQuery ? "من شوارع الأعيان " : "";
        let statusLabel = targetStatus === "غير منفذ" ? "غير المنفذة " : (targetStatus === "منفذ" ? "المنفذة " : "");
        let districtsLabel = targetDistricts.length > 0 ? `في (${targetDistricts.join(" و ")})` : "في النظام";
        
        addMessage(`بناءً على طلبك، يوجد (${count}) شارعاً ${ayanLabel}${statusLabel}${districtsLabel}. هل تود استخراج تقرير بهذه البيانات؟`, 'bot');
        awaitingExportConfirmation = true;
        return;
    }

    // ج. البحث عن اسم شارع أو طوله (المنطق الافتراضي)
    const stopWords = /\b(اين|يقع|فين|شارع|طريق|كم|طوله|طول|منطقه|مدينه|هو|هي)\b/g;
    const qClean = qText.replace(stopWords, "").trim();
    let currentMatch = null;
    if (qClean.length > 2) {
        geojsonData.features.forEach(f => {
            const sName = normalizeArabic(f.properties.Name_Ar);
            if (sName && (qClean.includes(sName) || sName.includes(qClean))) currentMatch = f;
        });
    }

    let targetStreet = currentMatch || (qText.includes("طول") ? lastSelectedStreet : null);
    if (targetStreet) {
        lastSelectedStreet = targetStreet;
        const name = targetStreet.properties.Name_Ar;
        if (qText.includes("طول")) {
            const lengthKm = (calculateFixedLength(name) / 1000).toFixed(2);
            addMessage(`يبلغ الطول الإجمالي لشارع "${name}" حوالي ${lengthKm} كم.`, 'bot');
        } else {
            addMessage(`تم العثور على شارع "${name}" في منطقة ${targetStreet.properties.DistrictName_Arabic || 'الظفرة'}.`, 'bot');
        }
        zoomToStreet(targetStreet);
    } else {
        addMessage("نعتذر، لم أفهم المطلب. يمكنك السؤال عن شوارع الأعيان أو طلب تقارير للمناطق.", "bot");
    }
}

// 6. وظائف التصدير (PDF & Excel)
function showExportModal() { document.getElementById('exportModal').style.display = 'block'; }
function closeExportModal() { document.getElementById('exportModal').style.display = 'none'; }
function executeExport() {
    const format = document.getElementById('fileFormat').value;
    const dateStr = new Date().toLocaleDateString('ar-EG');
    if (format === 'pdf') {
        const printContent = document.createElement('div');
        printContent.style.direction = 'rtl';
        printContent.style.padding = '20px';
        printContent.style.fontFamily = "'Tajawal', sans-serif";
        printContent.innerHTML = `
            <h2 style="text-align:center; color:#1a2a6c;">تقرير شوارع منطقة الظفرة</h2>
            <p style="text-align:center;">تاريخ التقرير: ${dateStr}</p>
            <table border="1" style="width:100%; border-collapse:collapse; text-align:center; margin-top:20px;">
                <thead><tr style="background:#f2f2f2;"><th>ID</th><th>الاسم</th><th>المنطقة</th><th>الحالة</th></tr></thead>
                <tbody>${lastFilteredReportData.map(d => `<tr><td>${d["الرقم التعريفي"]}</td><td>${d["الاسم العربي"]}</td><td>${d["المنطقة"]}</td><td>${d["الحالة"]}</td></tr>`).join('')}</tbody>
            </table>`;
        html2pdf().set({ margin: 10, filename: `تقرير_الظفرة.pdf`, jsPDF: { orientation: 'landscape' } }).from(printContent).save().then(closeExportModal);
    } else {
        const ws = XLSX.utils.json_to_sheet(lastFilteredReportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "الشوارع");
        XLSX.writeFile(wb, `تقرير_شوارع_الظفرة.xlsx`);
        closeExportModal();
    }
}

// 7. واجهة المستخدم والبحث
function zoomToStreet(feature) {
    allStreetsLayer.eachLayer(l => { if (l.feature === feature) { highlightStreet(l); map.flyToBounds(l.getBounds(), { maxZoom: 16 }); } });
}

function addMessage(text, side) {
    const box = document.getElementById('chat-box');
    const msg = document.createElement('div');
    msg.className = side + '-msg';
    msg.innerText = text;
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight;
}

window.onload = () => {
    addMessage("أهلاً بك! أنا مساعدك الذكي. اسألني عن الشوارع، الإحصائيات، أو اطلب تقريراً.", "bot");
    const sendBtn = document.getElementById('send-ai-btn');
    const input = document.getElementById('ai-input');
    const send = () => { if (input.value) { addMessage(input.value, 'user'); processAI(input.value); input.value = ''; } };
    if(sendBtn) sendBtn.onclick = send;
    if(input) input.onkeypress = (e) => { if(e.key === 'Enter') send(); };
};

document.getElementById('searchBox').oninput = (e) => {
    let rawTerm = e.target.value.trim();
    const termNorm = normalizeArabic(rawTerm.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)));
    const filtered = geojsonData.features.filter(f => {
        return normalizeArabic(f.properties.Name_Ar).includes(termNorm) || String(f.properties.RoadID).includes(termNorm);
    });
    renderList(filtered);
};

function renderList(features) {
    const list = document.getElementById('resultsList');
    list.innerHTML = '';
    features.slice(0, 100).forEach(f => {
        const div = document.createElement('div');
        div.className = 'street-item';
        div.innerHTML = `<b>${f.properties.Name_Ar || 'غير مسمى'}</b><br><small>ID: ${f.properties.RoadID || '-'}</small>`;
        div.onclick = () => {
            allStreetsLayer.eachLayer(l => {
                if (String(l.feature.properties.RoadID) === String(f.properties.RoadID)) {
                    lastSelectedStreet = f;
                    highlightStreet(l);
                    map.flyToBounds(l.getBounds(), { maxZoom: 18 });
                }
            });
        };
        list.appendChild(div);
    });
    document.getElementById('stats').innerText = `العناصر الظاهرة: ${features.length}`;
}
