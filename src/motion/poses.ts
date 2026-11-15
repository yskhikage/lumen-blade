// Pose data for the hero: idle / run cycle / air / keyframed sword combos.
// Angles are Euler [x, y, z] in radians on VRM normalized bones (VRM1 axes; VRM0 is mirrored at runtime).
// @ts-nocheck
export const Z3 = [0,0,0];
export const lerpA = (a,b,t) => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
export function mixPose(A, B, t){ const o = {}; for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) o[k] = lerpA(A[k]||Z3, B[k]||Z3, t); return o; }
export const STANCE = { leftUpperLeg:[-.45,0,.1], leftLowerLeg:[.55,0,0], rightUpperLeg:[.35,0,-.1], rightLowerLeg:[.5,0,0] };
export const POSE = {
  idle:{ spine:[.05,-.25,0], chest:[0,-.1,0], neck:[0,.15,0], head:[0,.2,0],
    rightUpperArm:[0,.45,1.15], rightLowerArm:[0,.9,0], leftUpperArm:[0,-.2,-1.2], leftLowerArm:[0,-.5,0],
    leftUpperLeg:[-.25,0,.08], leftLowerLeg:[.35,0,0], rightUpperLeg:[.25,0,-.08], rightLowerLeg:[.4,0,0] },
  air:{ spine:[.15,0,0], rightUpperArm:[0,.2,.7], rightLowerArm:[0,.6,0], leftUpperArm:[0,-.2,-.8], leftLowerArm:[0,-.6,0],
    leftUpperLeg:[-1.1,0,.1], leftLowerLeg:[1.5,0,0], rightUpperLeg:[-.3,0,-.1], rightLowerLeg:[1.0,0,0] },
  a1a:{ ...STANCE, spine:[0,-.6,0], chest:[0,-.3,0], head:[0,.6,0], rightUpperArm:[0,-.5,.25], rightLowerArm:[0,.3,0], leftUpperArm:[0,-.6,-1.0], leftLowerArm:[0,-.6,0] },
  a1b:{ ...STANCE, spine:[0,.5,0], chest:[0,.3,0], head:[0,-.5,0], rightUpperArm:[0,1.9,.25], rightLowerArm:[0,.2,0], leftUpperArm:[0,.3,-1.2], leftLowerArm:[0,-.6,0] },
  a3a:{ ...STANCE, spine:[-.2,0,0], rightUpperArm:[0,.9,-1.3], rightLowerArm:[0,.4,0], leftUpperArm:[0,.9,-1.1], leftLowerArm:[0,-.4,0] },
  a3b:{ spine:[.45,0,0], chest:[.2,0,0], rightUpperArm:[0,1.3,.9], rightLowerArm:[0,.2,0], leftUpperArm:[0,-.3,-1.2],
    leftUpperLeg:[-.75,0,.05], leftLowerLeg:[.95,0,0], rightUpperLeg:[.45,0,-.05], rightLowerLeg:[.55,0,0] },
  dodge:{ spine:[.9,0,0], chest:[.4,0,0], head:[.3,0,0], rightUpperArm:[-1,0,1.1], rightLowerArm:[0,1.4,0], leftUpperArm:[-1,0,-1.1], leftLowerArm:[0,-1.4,0],
    leftUpperLeg:[-1.7,0,.1], leftLowerLeg:[2.2,0,0], rightUpperLeg:[-1.7,0,-.1], rightLowerLeg:[2.2,0,0] },
  spin:{ spine:[.1,0,0], rightUpperArm:[0,.15,.05], rightLowerArm:[0,.1,0], leftUpperArm:[0,0,-.35], leftLowerArm:[0,-.3,0],
    leftUpperLeg:[-.9,0,.15], leftLowerLeg:[1.3,0,0], rightUpperLeg:[-.5,0,-.15], rightLowerLeg:[1.1,0,0] },
  hurt:{ spine:[-.35,.1,0], head:[-.3,0,0], rightUpperArm:[0,.2,.8], rightLowerArm:[0,.5,0], leftUpperArm:[0,0,-.8], leftLowerArm:[0,-.5,0],
    leftUpperLeg:[-.3,0,.1], leftLowerLeg:[.5,0,0], rightUpperLeg:[.3,0,-.1], rightLowerLeg:[.3,0,0] }
};
POSE.a2a = POSE.a1b; POSE.a2b = POSE.a1a;
export function runPose(ph){
  const s = Math.sin(ph), c = Math.cos(ph);
  return { spine:[.32,.12*s,0], chest:[0,-.2*s,0], head:[-.15,.1*s,0], hips:[0,.15*s,0],
    leftUpperLeg:[-.8*s-.15,0,.05], leftLowerLeg:[.35+.95*Math.max(0,Math.sin(ph-1.3)),0,0],
    rightUpperLeg:[.8*s-.15,0,-.05], rightLowerLeg:[.35+.95*Math.max(0,Math.sin(ph+Math.PI-1.3)),0,0],
    leftUpperArm:[.7*s,0,-1.25], leftLowerArm:[0,-1.0,0], rightUpperArm:[.2,-.45,1.05], rightLowerArm:[0,.45,0] };
}
export const smooth = t => t*t*(3-2*t);
export const LEG_L = {leftUpperLeg:[-.8,0,.12], leftLowerLeg:[.9,0,0], leftFoot:[-.1,0,0], rightUpperLeg:[.5,0,-.12], rightLowerLeg:[.35,0,0], rightFoot:[.3,0,0]};
export const LEG_R = {rightUpperLeg:[-.8,0,-.12], rightLowerLeg:[.9,0,0], rightFoot:[-.1,0,0], leftUpperLeg:[.5,0,.12], leftLowerLeg:[.35,0,0], leftFoot:[.3,0,0]};
export const LEG_SET = {leftUpperLeg:[-.3,0,.12], leftLowerLeg:[.55,0,0], rightUpperLeg:[.2,0,-.12], rightLowerLeg:[.7,0,0]};
export const ATK = {
  1:[ {u:0,   hy:-.08, bl:[-2.4,.15], pose:{...LEG_SET, hips:[0,-.35,0], spine:[.05,-.5,0], chest:[0,-.3,0], head:[0,.75,0], rightUpperArm:[0,-.8,.35], rightLowerArm:[0,.6,0], leftUpperArm:[0,-.3,-1.0], leftLowerArm:[0,-.9,0]}},
      {u:.14, hy:-.1,  bl:[-2.55,.2], pose:{...LEG_SET, hips:[0,-.42,0], spine:[.05,-.62,0], chest:[0,-.36,0], head:[0,.8,0], rightUpperArm:[0,-.95,.4], rightLowerArm:[0,.75,0], leftUpperArm:[0,-.2,-.9], leftLowerArm:[0,-1.0,0]}},
      {u:.32, hy:-.14, bl:[1.4,.05], pose:{...LEG_L, hips:[0,.35,0], spine:[.18,.5,0], chest:[.05,.3,0], head:[0,-.65,0], rightUpperArm:[0,1.6,.3], rightLowerArm:[0,.15,0], leftUpperArm:[.4,.7,-1.25], leftLowerArm:[0,-.4,0]}},
      {u:.62, hy:-.15, bl:[2.1,0], pose:{...LEG_L, hips:[0,.45,0], spine:[.22,.62,0], chest:[.06,.38,0], head:[0,-.75,0], rightUpperArm:[0,2.0,.45], rightLowerArm:[0,.1,0], leftUpperArm:[.5,.8,-1.3], leftLowerArm:[0,-.3,0]}},
      {u:1,   hy:-.1,  bl:[1.6,-.2], pose:{...LEG_L, hips:[0,.3,0], spine:[.12,.35,0], chest:[0,.2,0], head:[0,-.4,0], rightUpperArm:[0,1.3,.7], rightLowerArm:[0,.4,0], leftUpperArm:[.2,.4,-1.2], leftLowerArm:[0,-.5,0]}} ],
  2:[ {u:0,   hy:-.12, bl:[2.2,-.05], pose:{...LEG_L, hips:[0,.45,0], spine:[.2,.6,0], chest:[.05,.38,0], head:[0,-.7,0], rightUpperArm:[0,2.1,.5], rightLowerArm:[0,.5,0], leftUpperArm:[.4,.8,-1.3], leftLowerArm:[0,-.4,0]}},
      {u:.12, hy:-.13, bl:[2.45,-.1], pose:{...LEG_L, hips:[0,.5,0], spine:[.2,.7,0], chest:[.05,.42,0], head:[0,-.75,0], rightUpperArm:[0,2.3,.6], rightLowerArm:[0,.9,0], leftUpperArm:[.4,.85,-1.3], leftLowerArm:[0,-.4,0]}},
      {u:.32, hy:-.14, bl:[-1.5,-.12], pose:{...LEG_R, hips:[0,-.4,0], spine:[.15,-.55,0], chest:[.05,-.35,0], head:[0,.6,0], rightUpperArm:[0,-.9,.25], rightLowerArm:[0,.1,0], leftUpperArm:[.3,-.3,-1.2], leftLowerArm:[0,-.6,0]}},
      {u:.62, hy:-.15, bl:[-2.1,-.2], pose:{...LEG_R, hips:[0,-.5,0], spine:[.2,-.65,0], chest:[.05,-.4,0], head:[0,.7,0], rightUpperArm:[0,-1.2,.35], rightLowerArm:[0,.1,0], leftUpperArm:[.3,-.4,-1.2], leftLowerArm:[0,-.6,0]}},
      {u:1,   hy:-.1,  bl:[-1.6,-.3], pose:{...LEG_R, hips:[0,-.3,0], spine:[.1,-.35,0], chest:[0,-.2,0], head:[0,.4,0], rightUpperArm:[0,-.6,.6], rightLowerArm:[0,.5,0], leftUpperArm:[.2,-.2,-1.2], leftLowerArm:[0,-.6,0]}} ],
  3:[ {u:0,   hy:-.16, bl:[.3,-.3], pose:{...LEG_SET, spine:[-.1,0,0], rightUpperArm:[0,.3,1.0], rightLowerArm:[0,.6,0], leftUpperArm:[0,-.2,-1.1], leftLowerArm:[0,-.6,0]}},
      {u:.15, hy:.1,   bl:[.05,1.95], pose:{spine:[-.35,0,0], chest:[-.15,0,0], head:[-.1,0,0], rightUpperArm:[0,.85,-1.5], rightLowerArm:[0,.35,0], leftUpperArm:[0,.85,-1.35], leftLowerArm:[0,-.35,0],
        leftUpperLeg:[-.9,0,.1], leftLowerLeg:[1.3,0,0], rightUpperLeg:[-.2,0,-.1], rightLowerLeg:[.9,0,0]}},
      {u:.32, hy:-.24, bl:[.05,-.85], pose:{...LEG_L, leftUpperLeg:[-1.0,0,.12], leftLowerLeg:[1.25,0,0], spine:[.65,0,0], chest:[.25,0,0], head:[.1,0,0], rightUpperArm:[0,1.25,.95], rightLowerArm:[0,.15,0], leftUpperArm:[0,-.2,-1.25], leftLowerArm:[0,-.5,0]}},
      {u:.65, hy:-.25, bl:[.05,-.95], pose:{...LEG_L, leftUpperLeg:[-1.0,0,.12], leftLowerLeg:[1.25,0,0], spine:[.7,0,0], chest:[.28,0,0], head:[.12,0,0], rightUpperArm:[0,1.3,1.0], rightLowerArm:[0,.1,0], leftUpperArm:[0,-.2,-1.25], leftLowerArm:[0,-.5,0]}},
      {u:1,   hy:-.12, bl:[.1,-.7], pose:{...LEG_L, spine:[.3,0,0], chest:[.1,0,0], rightUpperArm:[0,1.0,1.0], rightLowerArm:[0,.3,0], leftUpperArm:[0,-.2,-1.2], leftLowerArm:[0,-.5,0]}} ]
};
export function sampleAtk(keys, u){
  let i = 0; while (i < keys.length-2 && u > keys[i+1].u) i++;
  const A = keys[i], B = keys[i+1], t = smooth(Math.min(1, Math.max(0, (u-A.u)/(B.u-A.u))));
  return { pose:mixPose(A.pose, B.pose, t), hy:A.hy+(B.hy-A.hy)*t, yaw:A.bl[0]+(B.bl[0]-A.bl[0])*t, pitch:A.bl[1]+(B.bl[1]-A.bl[1])*t };
}
export function runPose2(ph, lean){
  const s = Math.sin(ph), c = Math.cos(ph);
  const kL = .25 + 1.25*Math.pow(Math.max(0, c), 1.5), kR = .25 + 1.25*Math.pow(Math.max(0, -c), 1.5);
  return { hips:[0,.2*s,.04*c], spine:[.22+lean,-.12*s,0], chest:[.05,-.14*s,0], neck:[-.05,0,0], head:[-.12-lean*.5,.08*s,0],
    leftUpperLeg:[-.9*s-.2,0,.06], leftLowerLeg:[kL,0,0], leftFoot:[.2*Math.max(0,c)-.25*Math.max(0,-c),0,0],
    rightUpperLeg:[.9*s-.2,0,-.06], rightLowerLeg:[kR,0,0], rightFoot:[.2*Math.max(0,-c)-.25*Math.max(0,c),0,0],
    leftUpperArm:[.75*s,0,-1.2], leftLowerArm:[0,-1.1+.3*s,0], rightUpperArm:[.25-.25*s,-.5,1.0], rightLowerArm:[0,.5,0] };
}
