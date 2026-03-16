// 1. الإعدادات الأساسية للخريطة
const googleStreets = L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] });
const map = L.map('map', { center: [23.65, 53.70], zoom: 9, layers: [googleStreets] });

let allStreetsLayer, geojsonData, lastSelectedStreet = null;
let lastFilteredReportData = []; 

// دالة تبديل التبويبات (هذه هي الدالة التي كانت تظهر خطأ OpenTab)
function openTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) selectedTab.classList.add('active');
    
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
}

// دالة توحيد النصوص العربية
const normalizeArabic = (text) => {
    if (!text) return "";
    return String(text)
        .replace(/[\u064B-\u0652]/g, "") 
        .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
        .replace(/\s+/g, " ").trim().toLowerCase();
};

// 2. تحميل البيانات وتنسيق الطبقات
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
                <div style="direction:rtl; text-align:right; font-family:'Tajawal';">
                    <strong>${props.Name_Ar || 'غير مسمى'}</strong><br>
                    <b>حالة تنفيذ اللوحات:</b> <span style="color:${statusColor}; font-weight:bold;">${status}</span>
                </div>`;
            layer.bindPopup(popupHTML);
            layer.on('click', () => { highlightStreet(layer); lastSelectedStreet = feature; });
        }
    }).addTo(map);
    renderList(data.features);
}).catch(err => console.error("خطأ في تحميل البيانات:", err));

// 3. مساعد الذكاء الاصطناعي ونظام التقارير
function processAI(query) {
    const qRaw = query.toLowerCase();
    const qNorm = normalizeArabic(query);
    const qText = qNorm.replace(/[؟?]/g, "");
    
    const isReportRequested = qText.includes("تقرير") || qText.includes("اطبع") || qText.includes("احفظ") || qText.includes("استخرج");

    if (qText.includes("عدد") || qText.includes("احصائ") || qText.includes("كم شارع") || (isReportRequested && qText.length > 5)) {
        const districts = [...new Set(geojsonData.features.map(f => f.properties.DistrictName_Arabic).filter(Boolean))];
        let targetDistrict = null;
        
        districts.forEach(d => {
            const dNorm = normalizeArabic(d);
            const coreName = dNorm.replace(/\b(منطقه|مدينه)\b/g, "").trim();
            if (coreName && qText.includes(coreName)) targetDistrict = d;
        });

        let targetStatus = null;
        if (qText.includes("منفذ")) {
            targetStatus = qText.includes("غير") ? "غير منفذ" : "منفذ";
        }

        let filteredData = geojsonData.features;
        if (targetDistrict) filteredData = filteredData.filter(f => f.properties.DistrictName_Arabic === targetDistrict);
        if (targetStatus) {
            filteredData = filteredData.filter(f => {
                const status = f.properties.Status || "";
                return targetStatus === "غير منفذ" ? status.includes("غير منفذ") : (status.includes("منفذ") && !status.includes("غير منفذ"));
            });
        }

        lastFilteredReportData = filteredData.map(f => ({
            "الرقم التعريفي": f.properties.RoadID || "-",
            "الاسم العربي": f.properties.Name_Ar || "-",
            "الاسم الإنجليزي": f.properties.Name_En || "-",
            "حالة تنفيذ اللوحات": f.properties.Status || "-"
        }));

        const count = filteredData.length;
        let statusLabel = targetStatus === "غير منفذ" ? "غير المنفذة " : (targetStatus === "منفذ" ? "المنفذة " : "");
        let districtLabel = targetDistrict ? `في منطقة ${targetDistrict}` : "في الظفرة ككل";
        
        let reply = `بناءً على طلبكم، تم إعداد البيانات لعدد الشوارع ${statusLabel}${districtLabel}. الإجمالي: ( ${count} ) شارعاً.`;
        
        let tableHTML = `
            <div id="report-to-print" style="direction:rtl; padding:15px; background:#fff; border:1px solid #ddd; border-radius:8px; margin-top:10px;">
                <h4 style="text-align:center; color:#1a2a6c;">تقرير الشوارع - الظفرة</h4>
                <table border="1" style="width:100%; border-collapse:collapse; font-size:11px; text-align:center;">
                    <tr style="background:#f2f2f2;"><th>ID</th><th>الاسم</th><th>الحالة</th></tr>
                    ${filteredData.slice(0, 5).map(f => `<tr><td>${f.properties.RoadID}</td><td>${f.properties.Name_Ar}</td><td>${f.properties.Status}</td></tr>`).join('')}
                </table>
            </div>`;

        addMessage(reply, 'bot');
        const box = document.getElementById('chat-box');
        const div = document.createElement('div'); div.innerHTML = tableHTML; box.appendChild(div);
        box.scrollTop = box.scrollHeight;

        if (isReportRequested) setTimeout(showExportModal, 1200);
        return;
    }

    if (isReportRequested && lastFilteredReportData.length > 0) {
        showExportModal();
        return;
    }

    const stopWords = /\b(اين|يقع|فين|شارع|طريق|كم|طوله|طول|منطقه|مدينه)\b/g;
    const qClean = qText.replace(stopWords, "").trim();
    let currentMatch = null;
    if (qClean.length > 2) {
        geojsonData.features.forEach(f => {
            const sName = normalizeArabic(f.properties.Name_Ar);
            if (sName && (qClean.includes(sName) || sName.includes(qClean))) currentMatch = f;
        });
    }

    let targetStreet = currentMatch || ( (qText.includes("طول") || qText.includes("كم")) ? lastSelectedStreet : null );

    if (targetStreet) {
        lastSelectedStreet = targetStreet;
        const name = targetStreet.properties.Name_Ar;
        if (qText.includes("طول") || qText.includes("كم")) {
            const len = (calculateFixedLength(name) / 1000).toFixed(2);
            addMessage(`طول شارع "${name}" هو ${len} كم تقريباً.`, 'bot');
        } else {
            addMessage(`تم العثور على "${name}" في ${targetStreet.properties.DistrictName_Arabic || 'المنطقة'}.`, 'bot');
        }
        zoomToStreet(targetStreet);
    } else {
        addMessage("لم أستطع فهم المطلب بدقة، يرجى التأكد من المسمى أو المنطقة.", "bot");
    }
}

// 4. وظائف التصدير والتحكم
function showExportModal() { 
    if(lastFilteredReportData.length === 0) return alert("لا توجد بيانات حالية للتقرير.");
    document.getElementById('exportModal').style.display = 'block'; 
}
function closeExportModal() { document.getElementById('exportModal').style.display = 'none'; }

function executeExport() {
    const format = document.getElementById('fileFormat').value;
    if (format === 'pdf') {
        const element = document.getElementById('report-to-print');
        html2pdf().set({ margin: 10, filename: 'تقرير_شوارع.pdf', jsPDF: { orientation: 'landscape' } }).from(element).save();
    } else {
        const ws = XLSX.utils.json_to_sheet(lastFilteredReportData);
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, "تقرير_شوارع.xlsx");
    }
    closeExportModal();
}

function highlightStreet(layer) {
    allStreetsLayer.eachLayer(l => { if (l.visibleLine) l.visibleLine.setStyle({ color: "#1a2a6c", weight: 1.5, opacity: 0.5 }); });
    if (layer.visibleLine) layer.visibleLine.setStyle({ color: "#ff0000", weight: 8, opacity: 1 }).bringToFront();
    layer.openPopup();
}

function calculateFixedLength(name) {
