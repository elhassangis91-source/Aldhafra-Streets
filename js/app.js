// 1. تعريف أنواع الخرائط (Base Maps) بالروابط الآمنة HTTPS
const baseMaps = {
    "Google Maps": L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }),
    "Imagery (أقمار صناعية)": L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }),
    "Light Gray (خريطة رمادية)": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20
    })
};

// 2. إعداد الخريطة والنوع الافتراضي
const map = L.map('map', {
    center: [23.65, 53.70],
    zoom: 9,
    layers: [baseMaps["Google Maps"]]
});

// 3. إضافة أداة الاختيار في جهة اليسار (topleft) بجانب أزرار الزووم
L.control.layers(baseMaps, null, { 
    position: 'topleft' 
}).addTo(map);

// 4. استكمال جلب البيانات (مع معالجة خطأ الـ Fetch)
fetch('data/AllStreets.json')
    .then(r => {
        if (!r.ok) throw new Error("لم يتم العثور على ملف البيانات AllStreets.json");
        return r.json();
    })
    .then(data => {
        geojsonData = data;
        // باقي كود الرسم والبحث...
    })
    .catch(err => {
        console.error("Uncaught TypeError: Failed to fetch", err);
    });
// 3. مساعد الذكاء الاصطناعي الحواري
function processAI(query) {
    const qRaw = query.toLowerCase();
    const qNorm = normalizeArabic(query);
    const qText = qNorm.replace(/[؟?]/g, "");

    // 1. التعامل مع التحية والترحيب
    const greetings = ["مرحبا", "اهلا", "السلام عليكم", "صباح الخير", "مساء الخير", "هلا", "hi", "hello"];
    if (greetings.some(greet => qText.includes(greet))) {
        addMessage("أهلاً بك! كيف يمكنني مساعدتك اليوم في استكشاف شوارع منطقة الظفرة؟", "bot");
        return; // توقف هنا ولا تبحث في الخرائط
    }

    // أ) التحقق من الرد التأكيدي للحفظ
    const positiveReplies = ["نعم", "ايوه", "اجل", "طبعا", "اوكي", "حفظ", "يب", "yes", "ok"];
    if (awaitingExportConfirmation && positiveReplies.some(word => qText.includes(word))) {
        awaitingExportConfirmation = false;
        showExportModal();
        addMessage("جاري فتح نافذة خيارات الحفظ...", "bot");
        return;
    } else if (awaitingExportConfirmation) {
        awaitingExportConfirmation = false; // إلغاء الطلب إذا كان الرد غير إيجابي
    }

    // ب) طلب تقرير أو تصدير
    const isReportRequested = qText.includes("تقرير") || qText.includes("اطبع") || qText.includes("احفظ") || qText.includes("اصدر") || qText.includes("انشئ");

    if (qText.includes("عدد") || qText.includes("احصائ") || qText.includes("كم شارع") || (isReportRequested && qText.length > 5)) {
        const districts = [...new Set(geojsonData.features.map(f => f.properties.DistrictName_Arabic).filter(Boolean))];
        let targetDistrict = null;
        districts.forEach(d => {
            const dNorm = normalizeArabic(d);
            const coreName = dNorm.replace(/\b(منطقه|مدينه)\b/g, "").trim();
            if (coreName && qText.includes(coreName)) targetDistrict = d;
        });

        let targetStatus = null;
        if (qText.includes("منفذ")) { targetStatus = qText.includes("غير") ? "غير منفذ" : "منفذ"; }

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
        
        addMessage(`تم حصر ( ${count} ) شارعاً ${statusLabel}${districtLabel}. هل تود تصدير هذه البيانات كتقرير؟`, 'bot');
        awaitingExportConfirmation = true; // تفعيل حالة انتظار التأكيد
        return;
    }

    // ج) البحث عن الشوارع والأطوال
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
        addMessage("لم أستطع فهم المطلب، يرجى كتابة اسم الشارع أو المنطقة بوضوح.", "bot");
    }
}

// 4. دالة حساب الأطوال المحدثة (تدعم MultiLineString)
function calculateFixedLength(name) {
    const segs = geojsonData.features.filter(f => normalizeArabic(f.properties.Name_Ar) === normalizeArabic(name));
    let total = 0;
    segs.forEach(s => {
        const type = s.geometry.type;
        const coords = s.geometry.coordinates;
        if (type === "LineString") {
            for (let i = 0; i < coords.length - 1; i++) total += L.latLng(coords[i][1], coords[i][0]).distanceTo(L.latLng(coords[i+1][1], coords[i+1][0]));
        } else if (type === "MultiLineString") {
            coords.forEach(line => {
                for (let i = 0; i < line.length - 1; i++) total += L.latLng(line[i][1], line[i][0]).distanceTo(L.latLng(line[i+1][1], line[i+1][0]));
            });
        }
    });
    return total; // تم حذف القسمة على 2 لضمان الطول الفعلي الكامل
}

// 5. وظائف التصدير
function showExportModal() { 
    if(lastFilteredReportData.length === 0) return alert("لا توجد بيانات حالية للتقرير.");
    document.getElementById('exportModal').style.display = 'block'; 
}
function closeExportModal() { document.getElementById('exportModal').style.display = 'none'; }

function executeExport() {
    const format = document.getElementById('fileFormat').value;
    if (format === 'pdf') {
        const printContent = document.createElement('div');
        printContent.style.direction = 'rtl'; printContent.style.padding = '20px'; printContent.style.fontFamily = "'Tajawal', sans-serif";
        printContent.innerHTML = `<h2 style="text-align:center;">تقرير شوارع الظفرة التفصيلي</h2><table border="1" style="width:100%; border-collapse:collapse; text-align:center; font-size:12px;"><thead><tr style="background:#f2f2f2;"><th>ID</th><th>الاسم العربي</th><th>الاسم الإنجليزي</th><th>الحالة</th></tr></thead><tbody>${lastFilteredReportData.map(item => `<tr><td>${item["الرقم التعريفي"]}</td><td>${item["الاسم العربي"]}</td><td>${item["الاسم الإنجليزي"]}</td><td>${item["حالة تنفيذ اللوحات"]}</td></tr>`).join('')}</tbody></table>`;
        html2pdf().set({ margin: 10, filename: 'تقرير_شوارع_الظفرة.pdf', jsPDF: { orientation: 'landscape' } }).from(printContent).save().then(closeExportModal);
    } else {
        const ws = XLSX.utils.json_to_sheet(lastFilteredReportData);
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "البيانات");
        XLSX.writeFile(wb, "تقرير_شوارع_الظفرة.xlsx"); closeExportModal();
    }
}

function highlightStreet(layer) {
    allStreetsLayer.eachLayer(l => { if (l.visibleLine) l.visibleLine.setStyle({ color: "#1a2a6c", weight: 1.5, opacity: 0.5 }); });
    if (layer.visibleLine) layer.visibleLine.setStyle({ color: "#ff0000", weight: 8, opacity: 1 }).bringToFront();
    layer.openPopup();
}

function zoomToStreet(feature) {
    allStreetsLayer.eachLayer(l => { if (l.feature === feature) { highlightStreet(l); map.flyToBounds(l.getBounds(), { maxZoom: 16 }); } });
}

function addMessage(text, side) {
    const box = document.getElementById('chat-box');
    const msg = document.createElement('div');
    msg.className = side + '-msg';
    msg.innerText = text;
    box.appendChild(msg);
    
    // النزول لآخر رسالة فوراً
    box.scrollTo({
        top: box.scrollHeight,
        behavior: 'smooth'
    });
}

window.onload = () => {
    addMessage("أهلاً بك في منصة الظفرة الذكية. كيف يمكنني مساعدتك؟", "bot");
    const send = () => { const input = document.getElementById('ai-input'); if(input.value) { addMessage(input.value, 'user'); processAI(input.value); input.value = ''; } };
    document.getElementById('send-ai-btn').onclick = send;
    document.getElementById('ai-input').onkeypress = (e) => { if(e.key === 'Enter') send(); };
};

document.getElementById('searchBox').oninput = (e) => {
    let term = normalizeArabic(e.target.value.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)));
    const filtered = geojsonData.features.filter(f => normalizeArabic(f.properties.Name_Ar).includes(term) || String(f.properties.RoadID).includes(term));
    renderList(filtered);
};

function renderList(features) {
    const list = document.getElementById('resultsList'); list.innerHTML = '';
    features.slice(0, 50).forEach(f => {
        const div = document.createElement('div'); div.className = 'street-item';
        div.innerHTML = `<b>${f.properties.Name_Ar}</b><br><small>ID: ${f.properties.RoadID}</small>`;
        div.onclick = () => { allStreetsLayer.eachLayer(l => { if (String(l.feature.properties.RoadID) === String(f.properties.RoadID)) { highlightStreet(l); map.flyToBounds(l.getBounds(), { maxZoom: 18 }); lastSelectedStreet = f; } }); };
        list.appendChild(div);
    });
}
