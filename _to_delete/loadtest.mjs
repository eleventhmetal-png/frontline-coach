try {
  const m = await import('./src/lib/voice.js');
  console.log('LOADED. exports:', Object.keys(m).length);
} catch (e) {
  console.log('LOAD FAILED:', e.message.slice(0,200));
}
