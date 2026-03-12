// 1. إعداد الخريطة والطبقات الأساسية
const googleStreets = L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] });
const map = L.map('map', { center: [23.65, 53.70], zoom: 9, layers: [googleStreets] });

let allStreetsLayer, geojsonData, lastSelectedStreet = null;

// دالة تبديل التبويبات بنظام رسمي
function openTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
}

// دالة معالجة النصوص الرسمية (توحيد الحروف وإزالة التشكيل)
const normalizeArabic = (text) => {
    if (!text) return "";
    return String(text)
        .replace(/[\u064B-\u0652]/g, "") 
        .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
        .replace(/\s+/g, " ").trim().toLowerCase();
};

// 2. تحميل البيانات وتنسيق الطبقات الجغرافية
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

            // التعديل تم هنا: كتابة "حالة تنفيذ اللوحات"
            const popupHTML = `
                <div style="direction:rtl; text-align:right; font-family: 'Tajawal', sans-serif;">
                    <strong style="font-size:16px; color:#2c3e50;">${props.Name_Ar || 'غير مسمى'}</strong><br>
                    <span style="font-size:13px; color:#95a5a6;">${props.Name_En || ''}</span><hr style="margin:8px 0;">
                    <b>المنطقة الجغرافية:</b> ${props.DistrictName_Arabic || '-'}<br>
                    <b>الحالة:</b> <span style="color:${statusColor}; font-weight:bold;">${status}</span>
                </div>`;
            layer.bindPopup(popupHTML);
            layer.on('click', () => { highlightStreet(layer); lastSelectedStreet = feature; });
        }
    }).addTo(map);
    renderList(data.features);
});

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
    return (rawTotal / 2);
}

// ---------------------------------------------------------
// مساعد الذكاء الاصطناعي - نظام الردود الرسمية المطور
// ---------------------------------------------------------
// استبدل دالة processAI الموجودة في الملف بهذه النسخة المطورة
// تحديث دالة معالجة الذكاء الاصطناعي لدعم الذاكرة والمطابقة المرنة
// المساعد الذكي - نسخة الفهم العميق والذاكرة المحدثة
function processAI(query) {
    const qRaw = query.toLowerCase();
    const qNorm = normalizeArabic(query);
    // إزالة علامات الاستفهام لضمان دقة البحث
    const qText = qNorm.replace(/[؟?]/g, "");
    
    let reply = "نعتذر، لم يتم العثور على نتائج مطابقة للاستعلام الحالي. يرجى التأكد من المسمى الصحيح للشارع أو المنطقة.";

    // 1. نظام إحصائيات المدن (عدد الشوارع) - مفصول بالكامل
    if (qText.includes("عدد") || qText.includes("احصائ") || qText.includes("كم شارع")) {
        const districts = [...new Set(geojsonData.features.map(f => f.properties.DistrictName_Arabic).filter(Boolean))];
        let targetDistrict = null;
        
        districts.forEach(d => {
            const dNorm = normalizeArabic(d);
            // استخراج الاسم الأساسي للمدينة (مثل "غياثي") وتجاهل "مدينة/منطقة"
            const coreName = dNorm.replace(/\b(منطقه|مدينه)\b/g, "").trim();
            if (coreName && qText.includes(coreName)) {
                targetDistrict = d;
            }
        });

        if (targetDistrict) {
            const count = geojsonData.features.filter(f => f.properties.DistrictName_Arabic === targetDistrict).length;
            reply = `بناءً على البيانات المتاحة، يبلغ عدد الشوارع في ${targetDistrict} ( ${count} ) شارعاً مسجلاً.`;
        } else {
            reply = `إجمالي عدد الشوارع المسجلة في قاعدة البيانات هو ${geojsonData.features.length} شارعاً.`;
        }
        
        // نرسل الرد وننهي الدالة هنا عشان ما يدخلش في بحث الشوارع
        setTimeout(() => addMessage(reply, 'bot'), 400);
        return;
    }

    // 2. البحث عن اسم الشارع (الوضع الافتراضي)
    // استبعاد كافة الكلمات التي قد تشوش على اسم الشارع
    const stopWords = /\b(اين|يقع|فين|شارع|طريق|ما|هو|هي|في|كم|طوله|طول|عن|موقع|اريد|معرفة|منطقه|مدينه)\b/g;
    const qClean = qText.replace(stopWords, "").trim();
    
    let currentMatch = null;
    if (qClean.length > 2) {
        geojsonData.features.forEach(f => {
            const sName = normalizeArabic(f.properties.Name_Ar);
            // مطابقة مرنة (لو جزء من الاسم أو الاسم كله)
            if (sName && (qClean.includes(sName) || sName.includes(qClean))) {
                currentMatch = f;
            }
        });
    }

    // 3. تحديد الشارع (الجديد يلغي القديم، ونستخدم الذاكرة لو سأل عن الطول بس)
    let targetStreet = null;
    if (currentMatch) {
        targetStreet = currentMatch;
        lastSelectedStreet = currentMatch; // تحديث الذاكرة بالشارع الجديد
    } else if (qText.includes("طول") || qText.includes("كم")) {
        targetStreet = lastSelectedStreet; // استدعاء من الذاكرة
    }

    // 4. صياغة الرد للشارع وتنفيذ زووم الخريطة
    if (targetStreet) {
        const name = targetStreet.properties.Name_Ar;
        const district = targetStreet.properties.DistrictName_Arabic || "المنطقة المحددة";

        if (qText.includes("طول") || qText.includes("كم")) {
            const lengthKm = (calculateFixedLength(name) / 1000).toFixed(2);
            reply = `يبلغ الطول الإجمالي لشارع "${name}" حوالي ${lengthKm} كم.`;
        } else {
            reply = `تم العثور على "${name}" في منطقة ${district}.`;
        }
        zoomToStreet(targetStreet);
    }

    setTimeout(() => addMessage(reply, 'bot'), 400);
}

function zoomToStreet(feature) {
    allStreetsLayer.eachLayer(l => {
        if (l.feature === feature) { highlightStreet(l); map.flyToBounds(l.getBounds(), { maxZoom: 16 }); }
    });
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
    // تحديث الرسالة الترحيبية لتكون رسمية عند التحميل
    const chatBox = document.getElementById('chat-box');
    if (chatBox) {
        chatBox.innerHTML = '<div class="bot-msg">نظام المساعد الذكي لمنصة الظفرة. يمكنكم الاستعلام عن أطوال الشوارع، إحصائيات المناطق، أو تحديد موقع عنصر جغرافي معين.</div>';
    }

    const sendBtn = document.getElementById('send-ai-btn');
    const input = document.getElementById('ai-input');
    const send = () => { if (input.value) { addMessage(input.value, 'user'); processAI(input.value); input.value = ''; } };
    if(sendBtn) sendBtn.onclick = send;
    if(input) input.onkeypress = (e) => { if(e.key === 'Enter') send(); };
};

// محرك قائمة البحث الجانبية
// محرك قائمة البحث الجانبية (مطور لدعم الأرقام التعريفية بدقة)
document.getElementById('searchBox').oninput = (e) => {
    let rawTerm = e.target.value.trim();
    
    // تحويل الأرقام العربية (الهندية) إلى إنجليزية فوراً لضمان التطابق مع قاعدة البيانات
    const englishNumbersTerm = rawTerm.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
    
    const termNorm = normalizeArabic(englishNumbersTerm);
    const termLower = englishNumbersTerm.toLowerCase();

    const filtered = geojsonData.features.filter(f => {
        const nameAr = normalizeArabic(f.properties.Name_Ar);
        // تحويل الرقم التعريفي إلى نص صريح لضمان عدم حدوث خطأ برمجي
        const roadID = String(f.properties.RoadID || "").toLowerCase();
        
        // البحث يشمل الاسم أو الرقم التعريفي
        return nameAr.includes(termNorm) || roadID.includes(termLower);
    });
    
    renderList(filtered);
};

function renderList(features) {
    const list = document.getElementById('resultsList');
    list.innerHTML = '';
    features.slice(0, 100).forEach(f => {
        const div = document.createElement('div');
        div.className = 'street-item';
        div.innerHTML = `<b>${f.properties.Name_Ar || 'غير مسمى'}</b><br><small>الرقم التعريفي: ${f.properties.RoadID || '-'}</small>`;
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
}