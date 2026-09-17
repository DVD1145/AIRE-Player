// PhiAI-Player || Easing table
const Easing = (() => {
  return [
    t=>t, t=>t,
    t=>Math.sin(t*Math.PI/2),
    t=>1-Math.cos(t*Math.PI/2),
    t=>1-(1-t)*(1-t),
    t=>t*t,
    t=>-(Math.cos(Math.PI*t)-1)/2,
    t=>t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2,
    t=>1-Math.pow(1-t,3),
    t=>t*t*t,
    t=>1-Math.pow(1-t,4),
    t=>t*t*t*t,
    t=>t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,
    t=>t<0.5?8*t*t*t*t:1-Math.pow(-2*t+2,4)/2,
    t=>1-Math.pow(1-t,5),
    t=>t*t*t*t*t,
    t=>t===1?1:1-Math.pow(2,-10*t),
    t=>t===0?0:Math.pow(2,10*t-10),
    t=>Math.sqrt(1-Math.pow(t-1,2)),
    t=>1-Math.sqrt(1-t*t),
    t=>{const c=1.70158,d=c+1;return 1+d*Math.pow(t-1,3)+c*Math.pow(t-1,2);},
    t=>{const c=1.70158;return c*t*t*t-(c-1)*t*t;},
    t=>t<0.5?(1-Math.sqrt(1-4*t*t))/2:(Math.sqrt(1-4*(t-1)*(t-1))+1)/2,
    t=>{const c=1.70158*1.525;if(t<0.5)return(Math.pow(2*t,2)*(c+1)+c)/2;return(Math.pow(2*t-2,2)*(c+1)+c+2)/2;},
    t=>{if(t===0||t===1)return t;return Math.pow(2,-10*t)*Math.sin((t*10-0.75)*2*Math.PI/3)+1;},
    t=>{if(t===0||t===1)return t;return -Math.pow(2,10*t-10)*Math.sin((t*10-10.75)*2*Math.PI/3);},
    t=>{const n1=7.5625,d1=2.75;if(t<1/d1)return n1*t*t;if(t<2/d1)return n1*(t-=1.5/d1)*t+0.75;if(t<2.5/d1)return n1*(t-=2.25/d1)*t+0.9375;return n1*(t-=2.625/d1)*t+0.984375;},
    t=>1-Easing[26](1-t),
    t=>t<0.5?(1-Easing[26](1-2*t))/2:(1+Easing[26](2*t-1))/2,
    t=>{if(t===0||t===1)return t;if(t<0.5)return -Math.pow(2,20*t-10)*Math.sin((20*t-11.125)*2*Math.PI/4.5)/2;return Math.pow(2,-20*t+10)*Math.sin((20*t-11.125)*2*Math.PI/4.5)/2+1;}
  ];
})();

