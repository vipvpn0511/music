(() => {
  const $ = id => document.getElementById(id);
  const audio = $("audio");
  let tracks = [], currentIndex = -1, favorites = new Set(), showFavorites = false;
  let shuffle = false, repeat = false, timerId = null, toastId = null, deferredInstall = null;

  const wave = $("waveform");
  for (let i=0;i<48;i++) {
    const bar=document.createElement("span");
    const h=5+Math.round(Math.abs(Math.sin(i*1.7)*Math.cos(i*.37))*23);
    bar.style.setProperty("--h",h+"px");
    bar.style.setProperty("--h2",(5+Math.round(Math.abs(Math.cos(i*2.1))*27))+"px");
    bar.style.setProperty("--delay",((i%11)*-.09)+"s");
    wave.appendChild(bar);
  }
  const fmt = s => {
    if (!Number.isFinite(s) || s < 0) return "۰:۰۰";
    const n=Math.floor(s), m=Math.floor(n/60), sec=String(n%60).padStart(2,"0");
    const fa=x=>String(x).replace(/\d/g,d=>"۰۱۲۳۴۵۶۷۸۹"[+d]);
    return fa(m+":"+sec);
  };
  function toast(message) {
    const el=$("toast"); el.textContent=message; el.classList.add("show");
    clearTimeout(toastId); toastId=setTimeout(()=>el.classList.remove("show"),2500);
  }
  function safeName(name){ return name.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ").trim() || name; }
  function render() {
    const q=$("searchInput").value.trim().toLocaleLowerCase();
    const visible=tracks.map((t,i)=>({...t,index:i})).filter(t=>
      (!showFavorites || favorites.has(t.id)) &&
      (!q || t.name.toLocaleLowerCase().includes(q) || t.artist.toLocaleLowerCase().includes(q))
    );
    $("songCount").textContent=String(tracks.length).replace(/\d/g,d=>"۰۱۲۳۴۵۶۷۸۹"[+d])+" آهنگ";
    $("favoritesFilter").classList.toggle("active",showFavorites);
    const list=$("trackList"); list.innerHTML="";
    if (!visible.length) {
      const empty=document.createElement("div"); empty.className="empty-state";
      empty.innerHTML='<div class="empty-icon">♫</div><strong></strong><p></p>';
      empty.querySelector("strong").textContent=tracks.length ? (showFavorites?"هنوز آهنگ موردعلاقه‌ای نداری":"نتیجه‌ای پیدا نشد") : "کتابخانه‌ات هنوز خالی است";
      empty.querySelector("p").textContent=tracks.length ? "عبارت جست‌وجو را تغییر بده یا فیلتر را بردار." : "با زدن «افزودن آهنگ»، فایل‌های صوتی گوشی را انتخاب کن.";
      list.appendChild(empty); return;
    }
    visible.forEach(t=>{
      const row=document.createElement("div"); row.className="track-row"+(t.index===currentIndex?" active":"");
      const art=document.createElement("div"); art.className="mini-art"; art.textContent="♫";
      const copy=document.createElement("div"); copy.className="row-copy";
      const title=document.createElement("strong"); title.textContent=t.name;
      const artist=document.createElement("small"); artist.textContent=t.artist;
      copy.append(title,artist);
      const duration=document.createElement("span"); duration.className="row-duration"; duration.textContent=t.duration?fmt(t.duration):"—";
      const fav=document.createElement("button"); fav.className="favorite-btn"+(favorites.has(t.id)?" fav":""); fav.textContent=favorites.has(t.id)?"♥":"♡"; fav.setAttribute("aria-label","موردعلاقه");
      fav.addEventListener("click",()=>{ favorites.has(t.id)?favorites.delete(t.id):favorites.add(t.id); render(); });
      const play=document.createElement("button"); play.className="row-play"; play.textContent=t.index===currentIndex&&!audio.paused?"Ⅱ":"▶"; play.setAttribute("aria-label","پخش آهنگ");
      play.addEventListener("click",()=>{ if(t.index===currentIndex){togglePlay();}else{playTrack(t.index);} });
      row.append(art,copy,duration,fav,play); list.appendChild(row);
    });
  }
  function updatePlaying() {
    const t=tracks[currentIndex];
    $("trackTitle").textContent=t?t.name:"هنوز آهنگی انتخاب نشده";
    $("trackArtist").textContent=t?t.artist:"از گوشی خودت موسیقی اضافه کن";
    $("trackFormat").textContent=t?(t.file.name.split(".").pop()||"AUDIO").toUpperCase()+" AUDIO":"MP3 · WAV · M4A";
    $("playBtn").textContent=audio.paused?"▶":"Ⅱ";
    $("playBtn").setAttribute("aria-label",audio.paused?"پخش":"توقف");
    $("albumWrap").classList.toggle("is-playing",!audio.paused);
    render();
  }
  function playTrack(index, autoplay=true) {
    if(index<0||index>=tracks.length)return;
    currentIndex=index; const t=tracks[index];
    audio.src=t.url; audio.load(); updatePlaying();
    if(autoplay) audio.play().then(updatePlaying).catch(()=>toast("برای پخش، یک بار دکمه پخش را لمس کن."));
  }
  function togglePlay() {
    if(currentIndex<0){ if(tracks.length)playTrack(0); else toast("ابتدا یک آهنگ اضافه کن."); return; }
    if(audio.paused) audio.play().then(updatePlaying).catch(()=>toast("پخش این فایل ممکن نشد."));
    else audio.pause();
    updatePlaying();
  }
  function next() {
    if(!tracks.length)return;
    let idx;
    if(shuffle && tracks.length>1){do{idx=Math.floor(Math.random()*tracks.length)}while(idx===currentIndex);}
    else idx=(currentIndex+1)%tracks.length;
    playTrack(idx);
  }
  function previous() {
    if(!tracks.length)return;
    if(audio.currentTime>3){audio.currentTime=0;return;}
    playTrack((currentIndex-1+tracks.length)%tracks.length);
  }
  function addFiles(fileList) {
    const files=Array.from(fileList||[]).filter(f=>f.type.startsWith("audio/")||/\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|weba|aiff?)$/i.test(f.name));
    if(!files.length){toast("فایل صوتی معتبری انتخاب نشد.");return;}
    files.forEach(file=>{
      const id=Date.now().toString(36)+Math.random().toString(36).slice(2);
      tracks.push({id,name:safeName(file.name),artist:"فایل داخل گوشی",file,url:URL.createObjectURL(file),duration:0});
    });
    render(); toast(files.length+" آهنگ اضافه شد.");
    if(currentIndex===-1)playTrack(0,false);
  }
  $("addMusicBtn").addEventListener("click",()=>$("fileInput").click());
  $("fileInput").addEventListener("change",e=>{addFiles(e.target.files);e.target.value="";});
  $("playBtn").addEventListener("click",togglePlay);
  $("nextBtn").addEventListener("click",next);
  $("prevBtn").addEventListener("click",previous);
  $("shuffleBtn").addEventListener("click",()=>{shuffle=!shuffle;$("shuffleBtn").classList.toggle("active",shuffle);toast(shuffle?"پخش تصادفی روشن شد":"پخش تصادفی خاموش شد");});
  $("repeatBtn").addEventListener("click",()=>{repeat=!repeat;audio.loop=repeat;$("repeatBtn").classList.toggle("active",repeat);toast(repeat?"تکرار آهنگ روشن شد":"تکرار آهنگ خاموش شد");});
  $("favoritesFilter").addEventListener("click",()=>{showFavorites=!showFavorites;render();});
  $("searchInput").addEventListener("input",render);
  $("volumeBar").addEventListener("input",e=>audio.volume=Number(e.target.value));
  audio.volume=.8;
  audio.addEventListener("timeupdate",()=>{if(audio.duration){$("seekBar").value=Math.round(audio.currentTime/audio.duration*1000);$("currentTime").textContent=fmt(audio.currentTime);$("duration").textContent=fmt(audio.duration);}});
  $("seekBar").addEventListener("input",()=>{if(audio.duration)audio.currentTime=(Number($("seekBar").value)/1000)*audio.duration;});
  audio.addEventListener("loadedmetadata",()=>{if(currentIndex>=0)tracks[currentIndex].duration=audio.duration; $("duration").textContent=fmt(audio.duration);render();});
  audio.addEventListener("ended",()=>{if(!repeat)next();});
  audio.addEventListener("play",updatePlaying); audio.addEventListener("pause",updatePlaying);
  $("themeBtn").addEventListener("click",()=>{document.body.classList.toggle("light-mode");localStorage.setItem("musicflow-theme",document.body.classList.contains("light-mode")?"light":"dark");});
  if(localStorage.getItem("musicflow-theme")==="light")document.body.classList.add("light-mode");

  $("timerBtn").addEventListener("click",()=>{$("timerModal").hidden=false;$("timerStatus").textContent=timerId?"تایمر فعال است.":"";});
  $("closeModal").addEventListener("click",()=>$("timerModal").hidden=true);
  $("timerModal").addEventListener("click",e=>{if(e.target===$("timerModal"))$("timerModal").hidden=true;});
  document.querySelectorAll("[data-minutes]").forEach(btn=>btn.addEventListener("click",()=>{
    clearTimeout(timerId);const mins=Number(btn.dataset.minutes);
    timerId=setTimeout(()=>{audio.pause();timerId=null;updatePlaying();toast("تایمر خواب، پخش را متوقف کرد.");},mins*60000);
    $("timerStatus").textContent="تایمر برای "+mins+" دقیقه تنظیم شد.";toast("تایمر خواب فعال شد.");
  }));
  $("cancelTimer").addEventListener("click",()=>{clearTimeout(timerId);timerId=null;$("timerStatus").textContent="تایمر لغو شد.";toast("تایمر لغو شد.");});

  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;$("installBtn").hidden=false;});
  $("installBtn").addEventListener("click",async()=>{if(!deferredInstall){toast("از منوی مرورگر گزینه نصب برنامه را انتخاب کن.");return;}deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$("installBtn").hidden=true;});
  if("serviceWorker" in navigator && location.protocol.startsWith("http")) window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));
  window.addEventListener("beforeunload",()=>tracks.forEach(t=>URL.revokeObjectURL(t.url)));
})();