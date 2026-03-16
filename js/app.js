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

// دالة معالجة النصوص الرسمية
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
// مساعد الذكاء الاصطناعي 
// ---------------------------------------------------------
// ---------------------------------------------------------
// مساعد الذكاء الاصطناعي - الفلترة الذكية للحالة
// ---------------------------------------------------------
// ---------------------------------------------------------
// مساعد الذكاء الاصطناعي - الفلترة الذكية للحالة
// ---------------------------------------------------------
function processAI(query) {
    const qRaw = query.toLowerCase();
    const qNorm = normalizeArabic(query);
    const qText = qNorm.replace(/[؟?]/g, "");
    
    let reply = "نعتذر، لم يتم العثور على نتائج مطابقة للاستعلام الحالي. يرجى التأكد من المسمى الصحيح للشارع أو المنطقة.";

    // 1. نظام إحصائيات المدن والحالات مع بناء جدول للتقرير
    if (qText.includes("عدد") || qText.includes("احصائ") || qText.includes("كم شارع")) {
        const districts = [...new Set(geojsonData.features.map(f => f.properties.DistrictName_Arabic).filter(Boolean))];
        let targetDistrict = null;
        
        districts.forEach(d => {
            const dNorm = normalizeArabic(d);
            const coreName = dNorm.replace(/\b(منطقه|مدينه)\b/g, "").trim();
            if (coreName && qText.includes(coreName)) { targetDistrict = d; }
        });

        let targetStatus = null;
        if (qText.includes("منفذ")) {
            targetStatus = qText.includes("غير") ? "غير منفذ" : "منفذ";
        }

        let filteredData = geojsonData.features;
        if (targetDistrict) { filteredData = filteredData.filter(f => f.properties.DistrictName_Arabic === targetDistrict); }
        if (targetStatus) {
            filteredData = filteredData.filter(f => {
                const status = f.properties.Status || "";
                return targetStatus === "غير منفذ" ? status.includes("غير منفذ") : (status.includes("منفذ") && !status.includes("غير منفذ"));
            });
        }

        const count = filteredData.length;
        let statusLabel = targetStatus === "غير منفذ" ? "غير المنفذة " : (targetStatus === "منفذ" ? "المنفذة " : "");
        let districtLabel = targetDistrict ? `في منطقة ${targetDistrict}` : "في منطقة الظفرة ككل";
        
        // إنشاء الرد النصي
        reply = `إليك التقرير المطلوب: عدد الشوارع ${statusLabel}${districtLabel} هو ( ${count} ) شارعاً. يمكنك تحميل الجدول كملف PDF من الزر أدناه.`;
        
        // بناء الجدول بتنسيق HTML للعرض والطباعة
        let tableHTML = `
            <div id="report-to-print" style="direction:rtl; padding:20px; font-family:'Tajawal', sans-serif;">
                <h2 style="text-align:center; color:#1a2a6c;">تقرير الشوارع - منصة الظفرة الذكية</h2>
                <p><b>نطاق البحث:</b> ${districtLabel} | <b>الحالة:</b> ${statusLabel || 'الكل'}</p>
                <table border="1" style="width:100%; border-collapse:collapse; margin-top:10px; text-align:center;">
                    <thead>
                        <tr style="background:#f2f2f2;">
                            <th style="padding:8px;">الرقم التعريفي</th>
                            <th style="padding:8px;">الاسم بالعربي</th>
                            <th style="padding:8px;">الاسم بالإنجليزي</th>
                            <th style="padding:8px;">حالة التنفيذ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredData.map(f => `
                            <tr>
                                <td style="padding:5px;">${f.properties.RoadID || '-'}</td>
                                <td style="padding:5px;">${f.properties.Name_Ar || '-'}</td>
                                <td style="padding:8px;">${f.properties.Name_En || '-'}</td>
                                <td style="padding:5px;">${f.properties.Status || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;

        setTimeout(() => {
            addMessage(reply, 'bot');
            // إضافة الجدول داخل رسالة البوت
            const box = document.getElementById('chat-box');
            const tableDiv = document.createElement('div');
            tableDiv.innerHTML = tableHTML;
            tableDiv.style.overflowX = "auto";
            box.appendChild(tableDiv);
            box.scrollTop = box.scrollHeight;
        }, 400);
        return;
    }
        
        // التعرف على المنطقة
        districts.forEach(d => {
            const dNorm = normalizeArabic(d);
            const coreName = dNorm.replace(/\b(منطقه|مدينه)\b/g, "").trim();
            if (coreName && qText.includes(coreName)) {
                targetDistrict = d;
            }
        });

        // التعرف الذكي على حالة التنفيذ (عشان نتجاوز الألف واللام)
        let targetStatus = null;
        if (qText.includes("منفذ")) {
            if (qText.includes("غير")) {
                targetStatus = "غير منفذ";
            } else {
                targetStatus = "منفذ";
            }
        }

        // فلترة البيانات بناءً على المنطقة والحالة
        let filteredData = geojsonData.features;
        
        if (targetDistrict) {
            filteredData = filteredData.filter(f => f.properties.DistrictName_Arabic === targetDistrict);
        }
        
        if (targetStatus) {
            filteredData = filteredData.filter(f => {
                const status = f.properties.Status || "";
                if (targetStatus === "غير منفذ") return status.includes("غير منفذ");
                return status.includes("منفذ") && !status.includes("غير منفذ");
            });
        }

        const count = filteredData.length;
        
        // صياغة الرد
        let statusLabel = targetStatus === "غير منفذ" ? "غير المنفذة " : (targetStatus === "منفذ" ? "المنفذة " : "");
        let districtLabel = targetDistrict ? `في منطقة ${targetDistrict}` : "في قاعدة البيانات";
        
        reply = `بناءً على البيانات المتاحة، يبلغ عدد الشوارع ${statusLabel}${districtLabel} ( ${count} ) شارعاً.`;
        
        setTimeout(() => addMessage(reply, 'bot'), 400);
        return;
    }

    // 2. البحث عن اسم الشارع (الوضع الافتراضي)
    const stopWords = /\b(اين|يقع|فين|شارع|طريق|وين|ما|هو|هي|في|كم|طوله|طول|عن|موقع|اريد|معرفة|منطقه|مدينه)\b/g;
    const qClean = qText.replace(stopWords, "").trim();
    
    let currentMatch = null;
    if (qClean.length > 2) {
        geojsonData.features.forEach(f => {
            const sName = normalizeArabic(f.properties.Name_Ar);
            if (sName && (qClean.includes(sName) || sName.includes(qClean))) {
                currentMatch = f;
            }
        });
    }

    let targetStreet = null;
    if (currentMatch) {
        targetStreet = currentMatch;
        lastSelectedStreet = currentMatch; 
    } else if (qText.includes("طول") || qText.includes("كم")) {
        targetStreet = lastSelectedStreet; 
    }

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
    const chatBox = document.getElementById('chat-box');
    if (chatBox) {
        chatBox.innerHTML = '<div class="bot-msg">أهلاً بك أنا مساعدك الذكي. كيف يمكنني مساعدتك.</div>';
    }

    const sendBtn = document.getElementById('send-ai-btn');
    const input = document.getElementById('ai-input');
    const send = () => { if (input.value) { addMessage(input.value, 'user'); processAI(input.value); input.value = ''; } };
    if(sendBtn) sendBtn.onclick = send;
    if(input) input.onkeypress = (e) => { if(e.key === 'Enter') send(); };
};

// محرك قائمة البحث (يدعم الأرقام العربية والإنجليزية)
document.getElementById('searchBox').oninput = (e) => {
    let rawTerm = e.target.value.trim();
    const englishNumbersTerm = rawTerm.replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
    const termNorm = normalizeArabic(englishNumbersTerm);
    const termLower = englishNumbersTerm.toLowerCase();

    const filtered = geojsonData.features.filter(f => {
        const nameAr = normalizeArabic(f.properties.Name_Ar);
        const roadID = String(f.properties.RoadID || "").toLowerCase();
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
    document.getElementById('stats').innerText = `العناصر الظاهرة: ${features.length}`;
}
