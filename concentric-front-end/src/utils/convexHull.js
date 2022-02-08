// Convex Hull
// http://bl.ocks.org/hollasch/9d3c098022f5524220bd84aae7623478

import * as d3 from "d3";
import { vecFrom, vecUnit, vecSum, vecScale, vecScaleTo, unitNormal } from "./utils";


// Hull Generators

const lineFn = d3.line()
    .curve(d3.curveCatmullRomClosed)
    // @ts-ignore
    .x(function (d) { return d.p[0]; })
    // @ts-ignore
    .y(function (d) { return d.p[1]; });


const smoothHull = function (polyPoints, hullPadding) {
    // Returns the SVG path data string representing the polygon, expanded and smoothed.

    const pointCount = polyPoints.length;

    // Handle special cases
    if (!polyPoints || pointCount < 1) return "";
    if (pointCount === 1) return smoothHull1(polyPoints, hullPadding);
    if (pointCount === 2) return smoothHull2(polyPoints, hullPadding);

    const hullPoints = polyPoints.map(function (point, index) {
        const pNext = polyPoints[(index + 1) % pointCount];
        return {
            p: point,
            v: vecUnit(vecFrom(point, pNext))
        };
    });

    // Compute the expanded hull points, and the nearest prior control point for each.
    for (let i = 0; i < hullPoints.length; ++i) {
        const priorIndex = (i > 0) ? (i - 1) : (pointCount - 1);
        const extensionVec = vecUnit(vecSum(hullPoints[priorIndex].v, vecScale(hullPoints[i].v, -1)));
        hullPoints[i].p = vecSum(hullPoints[i].p, vecScale(extensionVec, hullPadding));
    }

    return lineFn(hullPoints);
}


const smoothHull1 = function (polyPoints, hullPadding) {
    // Returns the path for a circular hull around a single point.

    const p1 = [polyPoints[0][0], polyPoints[0][1] - hullPadding];
    const p2 = [polyPoints[0][0], polyPoints[0][1] + hullPadding];

    return 'M ' + p1
        + ' A ' + [hullPadding, hullPadding, '0,0,0', p2].join(',')
        + ' A ' + [hullPadding, hullPadding, '0,0,0', p1].join(',');
};


const smoothHull2 = function (polyPoints, hullPadding) {
    // Returns the path for a rounded hull around two points.

    const v = vecFrom(polyPoints[0], polyPoints[1]);
    const extensionVec = vecScaleTo(v, hullPadding);

    const extension0 = vecSum(polyPoints[0], vecScale(extensionVec, -1));
    const extension1 = vecSum(polyPoints[1], extensionVec);

    const tangentHalfLength = 1.2 * hullPadding;
    const controlDelta = vecScaleTo(unitNormal(v), tangentHalfLength);
    const invControlDelta = vecScale(controlDelta, -1);

    const control0 = vecSum(extension0, invControlDelta);
    const control1 = vecSum(extension1, invControlDelta);
    const control3 = vecSum(extension0, controlDelta);

    return 'M ' + extension0
        + ' C ' + [control0, control1, extension1].join(',')
        + ' S ' + [control3, extension0].join(',')
        + ' Z';
};

export default smoothHull;