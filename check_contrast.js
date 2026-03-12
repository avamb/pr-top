function luminance(hex) {
  var r = parseInt(hex.slice(1,3),16)/255;
  var g = parseInt(hex.slice(3,5),16)/255;
  var b = parseInt(hex.slice(5,7),16)/255;
  var sR = r <= 0.03928 ? r/12.92 : Math.pow((r+0.055)/1.055, 2.4);
  var sG = g <= 0.03928 ? g/12.92 : Math.pow((g+0.055)/1.055, 2.4);
  var sB = b <= 0.03928 ? b/12.92 : Math.pow((b+0.055)/1.055, 2.4);
  return 0.2126*sR + 0.7152*sG + 0.0722*sB;
}
function contrast(c1,c2) {
  var l1 = luminance(c1), l2 = luminance(c2);
  var lighter = Math.max(l1,l2), darker = Math.min(l1,l2);
  return ((lighter+0.05)/(darker+0.05)).toFixed(2);
}
var pairs = [
  ['text #1C1917 on bg #FAFAF9', '#1C1917', '#FAFAF9'],
  ['white on primary #0D9488', '#FFFFFF', '#0D9488'],
  ['white on primary-600 #0F766E', '#FFFFFF', '#0F766E'],
  ['error #EF4444 on bg #FAFAF9', '#EF4444', '#FAFAF9'],
  ['error #DC2626 on bg #FAFAF9', '#DC2626', '#FAFAF9'],
  ['error #DC2626 on white', '#DC2626', '#FFFFFF'],
  ['secondary #78716C on bg #FAFAF9', '#78716C', '#FAFAF9'],
];
pairs.forEach(function(p) { process.stdout.write(p[0] + ': ' + contrast(p[1], p[2]) + ':1\n'); });
