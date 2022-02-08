
// Point/Vector Operations

export const vecFrom = function (p0, p1) {               // Vector from p0 to p1
    return [p1[0] - p0[0], p1[1] - p0[1]];
}

export const vecScale = function (v, scale) {            // Vector v scaled by 'scale'
    return [scale * v[0], scale * v[1]];
}

export const vecSum = function (pv1, pv2) {              // The sum of two points/vectors
    return [pv1[0] + pv2[0], pv1[1] + pv2[1]];
}

export const vecUnit = function (v) {                    // Vector with direction of v and length 1
    const norm = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
    return vecScale(v, 1 / norm);
}

export const vecScaleTo = function (v, length) {         // Vector with direction of v with specified length
    return vecScale(vecUnit(v), length);
}

export const unitNormal = function (pv0, p1) {           // Unit normal to vector pv0, or line segment from p0 to p1
    if (p1 != null) pv0 = vecFrom(pv0, p1);
    const normalVec = [-pv0[1], pv0[0]];
    return vecUnit(normalVec);
};