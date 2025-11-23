import './style.css'

import PocketBase from 'pocketbase';

var map = L.map("map").setView([45.25, 10.04], 3);
var cache = {}

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const pb = new PocketBase('http://127.0.0.1:8090');


//aggiorna caratteristiche
const updateStatsDashboard = (temperatures) => {
    const cleanTemps = temperatures.filter(t => !isNaN(t));

    const count = temperatures.length;
    let avgTemp = 'N/D';
    let maxTemp = 'N/D';
    let minTemp = 'N/D';

    if (count > 0) {
        const sum = cleanTemps.reduce((a, b) => a + b, 0);
        avgTemp = (sum / count).toFixed(2);
        maxTemp = Math.max(...cleanTemps).toFixed(2);
        minTemp = Math.min(...cleanTemps).toFixed(2);
    }

    document.getElementById('count').textContent = count;
    document.getElementById('avg-temp').textContent = avgTemp;
    document.getElementById('max-temp').textContent = maxTemp;
    document.getElementById('min-temp').textContent = minTemp;
};

const caricaDati = async () => {
    const currentTemperatures = [];
    
    // Rimuovi dulicati
    map.eachLayer(function(layer) {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    const resultList = await pb.collection('prova').getList();
    const items = resultList.items;
    console.log(items);

    // Promise.all esegue in parallelo
    await Promise.all(resultList.items.map(async(item) => {
        const lat = item.geopoint.lat;
        const lon = item.geopoint.lon;
        const cacheKey = `${lat},${lon}`;
        
        let citta;
        let temp;

        if (cache[cacheKey]) {
            // Dati trovati nella cache
            console.log(`Dati ${cacheKey} trovati in cache.`);
            citta = cache[cacheKey].citta;
            temp = cache[cacheKey].temp;
        } else {
            // Dati non trovati
            console.log(`Dati per ${cacheKey} non trovati.`);
            
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=geojson&lat=${lat}&lon=${lon}&layer=address`
                );
                if (!response.ok)
                    throw new Error(`HTTP ${response.status} da Nominatim`);
                const data = await response.json();
                citta = data.features[0].properties.address.county || 'N/D';
                
            } catch (error) {
                console.error("Errore Nominatim:", error);
                citta = 'Errore API';
            }

            try {
                 temp = await temperatura(lat, lon);
            } catch (error) {
                console.error("errore Open-Meteo:", error);
                temp = NaN;
            }
            

            cache[cacheKey] = {
                citta: citta,
                temp: temp
            };
        }
        
        //temperature
        currentTemperatures.push(parseFloat(temp));


        L.marker([lat, lon]).addTo(map)
            .bindPopup(`città: ${citta} <br> lat: ${lat} <br> lon: ${lon} <br> temperatura: ${!isNaN(temp) ? `${temp} °C` : 'N/D'}`);
            
    }));
    
    updateStatsDashboard(currentTemperatures);
};


const temperatura = async (lat, lon) => {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m`);
    if (!response.ok)
        throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    return data.current.temperature_2m;
};



caricaDati();


map.on("click", async function (ev) {
    console.log(ev.latlng)//coordinate del click
        const data = {
            geopoint: {
                lon: ev.latlng.lng,
                lat: ev.latlng.lat
                
            }
        }
        
    const record = await pb.collection('prova').create(data);
    caricaDati();
    })