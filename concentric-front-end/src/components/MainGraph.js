import React from 'react';
import * as d3 from "d3";
import smoothHull from '../utils/convexHull';

import "../styles/MainGraph.css";
import EntityAutoComplete from './entityAutoComplete';

const dummyData = {
    'nodes': { nodes: ["uniprot_P05231"] },
    category_count: { categorycount: {
        "1": 5,
        "2": 5,
        "3": 5,
        "4": 5,
    }}
};

const width = 900, height = 900;

// values for all forces
// https://www.youtube.com/watch?v=JAe7Oscsp98
const forceProperties = {
    center: {
        enabled: false,
        x: 0.5,
        y: 0.5,
        strength: 0.1
    },
    charge: {
        enabled: true,
        strength: -500,
        distanceMin: 1,
        distanceMax: 1000
    },
    collide: {
        enabled: true,
        strength: .4,
        iterations: 1,
        radius: 29
    },
    separation: {
        enabled: true,
        strength: 0.1,
        radius: width*0.25
    },
    link: {
        enabled: true,
        strength: 0.9,
        iterations: 1,
        distanceFactor: 5
    },
    radial: {
        enabled: false,
        strength: 1,
        categoryRadius: [400, 300, 200, 1]
    }
};

const normalizeDistance = (x, xMin, xMax, minDist, maxDist) => {
    const dist = xMax+1 - Math.min(xMax, x);
    return (dist - xMin)/(xMax - xMin)*(maxDist-minDist) + minDist;

}

const calculateCategoryCenters = (cats, r) => [...Array(cats).keys()].map(i => [width/2 + Math.round(r * Math.cos(2*Math.PI*i/cats)), height/2 + Math.round(r * Math.sin(2*Math.PI*i/cats))]);

const MainGraph = () => {
    console.log("Module Loading");

    const simulation = d3.forceSimulation();

    simulation.stop()
        .force("link", d3.forceLink())
        .force("charge", d3.forceManyBody())
        .force("collide", d3.forceCollide())
        .force("center", d3.forceCenter())
        .force("forceX", d3.forceX())
        .force("forceY", d3.forceY())
        .force("r", d3.forceRadial(
            d =>  forceProperties.radial.categoryRadius[d['category']-1],
            width/2,
            height/2 
        ));


    let maxDist = 100;
    const updateForces = () => {
        // get each force by name and update the properties
        simulation.force("center")
            // @ts-ignore
            .x(width * forceProperties.center.x)
            .y(height * forceProperties.center.y)
            .strength(forceProperties.center.enabled ? forceProperties.center.strength : 0);
        simulation.force("charge")
            // @ts-ignore
            .strength(forceProperties.charge.strength * forceProperties.charge.enabled)
            .distanceMin(forceProperties.charge.distanceMin)
            .distanceMax(forceProperties.charge.distanceMax);
        simulation.force("collide")
            // @ts-ignore
            .strength(forceProperties.collide.strength * forceProperties.collide.enabled)
            .radius(forceProperties.collide.radius)
            .iterations(forceProperties.collide.iterations);

        const cat_centers = calculateCategoryCenters(4, forceProperties.separation.radius)
        simulation.force("forceX")
            // @ts-ignore
            .strength(forceProperties.separation.strength * forceProperties.separation.enabled)
            .x(d => cat_centers[d['category'] - 1][0]);
        simulation.force("forceY")
            // @ts-ignore
            .strength(forceProperties.separation.strength * forceProperties.separation.enabled)
            .y(d => cat_centers[d['category'] - 1][1]);

        simulation.force("r")
            // @ts-ignore
            .radius(d =>  forceProperties.radial.categoryRadius[d['category']-1])
            .strength(forceProperties.radial.strength * (forceProperties.radial.enabled?1:0));

        simulation.force("link")
            // @ts-ignore
            .distance(d => normalizeDistance(d.freq, 1, maxDist, 1, 50)*forceProperties.link.distanceFactor)
            .iterations(forceProperties.link.iterations)
            // @ts-ignore
            .strength(forceProperties.link.enabled ? simulation.force("link").strength() : 0)

        // updates ignored until this is run
        // restarts the simulation (important if simulation has already slowed down)
        simulation.alpha(1).alphaMin(-1).restart();
    }

    const svgRef = React.useRef();
    // const [selectedNode, setSelectedNode] = React.useState(dummyData);
    let selectedNode = dummyData;
    const cleanUp = () => {
        // console.log('Clean up');
        // d3.select('g.linkgroup').remove();
        // d3.select('g.hullgroup').remove();
        // d3.select('g.nodegroup').remove();

        // d3.select(svgRef.current).select('g.everything').append('g').attr('class', 'hullgroup');
        // d3.select(svgRef.current).select('g.everything').append('g').attr('class', 'linkgroup');
        // d3.select(svgRef.current).select('g.everything').append('g').attr('class', 'nodegroup');
    };
    const setSelectedNode = (d) => {
        selectedNode = d;
        cleanUp();
        d3UpdateFunc();
    };
    const updateNodeSuggestions = (d) => {
        setSelectedNode({
            ...selectedNode,
            nodes: {nodes: d}
        });
    };

    const subgraph = {
        nodes: [], links: []
    };

    const d3UpdateFunc = () => {
        console.log("effect called");
        if (selectedNode.nodes.nodes.length === 0) { 
            setSelectedNode(dummyData);
            return;
        }

        const svgRoot = d3.select(svgRef.current);
        const svg = d3.select(svgRef.current).select("g.everything");
        const svgHullGroup = svg.select('g.hullgroup');
        const svgLinkGroup = svg.select('g.linkgroup');
        const svgNodeGroup = svg.select('g.nodegroup');
        const legendGroup = svgRoot.select('g.legendgroup');

        svgHullGroup
            .selectAll('path')
            .data([{category:1}, {category:2}, {category:3}, {category:4}], d => d.category)
            .enter()
            .append('path')
            .attr('class', d => 'hull_' + (d.category));

        fetch('http://127.0.0.1:8000/getbestsubgraph', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(selectedNode)
        }).then(response => response.json())
        .then(newSubgraph => {
            const newNodes = [];
            const newLinks = [];
            for(let i in newSubgraph.nodes) {
                const myNode = subgraph.nodes.findIndex(node => node.id === newSubgraph.nodes[i].id)
                if (myNode !== -1) {
                    newNodes.push({
                        ...subgraph.nodes[myNode],
                        ...newSubgraph.nodes[i]
                    });
                }
                else {
                    newNodes.push({
                        ...newSubgraph.nodes[i],
                        x: width/2,
                        y: height/2,
                    });
                }
            }
            for(let i in newSubgraph.links) {
                const myEdge = subgraph.links.findIndex(edge => edge.source.id === newSubgraph.links[i].source && edge.target.id === newSubgraph.links[i].target)
                if (myEdge !== -1) {
                    newLinks.push({
                        ...subgraph.links[myEdge],
                        ...newSubgraph.links[i]
                    });
                }
                else {
                    newLinks.push(newSubgraph.links[i]);
                }
            }
            subgraph.nodes = newNodes;
            subgraph.links = newLinks;

            const link = svgLinkGroup
                .selectAll('g.line')
                .data(subgraph.links, d => d.source + d.target)
                .join(
                    enter => {
                        const lineGroup = enter
                            .append('g')
                            .attr('class', d => "line " + d.source + " " + d.target)
                            .classed('betweencategory', d => d['samecategory'])
                            .classed('intracategory', d => !d['samecategory']);
                        lineGroup.append("text")
                            .text(d => d.freq);
                        const lineItem = lineGroup.append("line");
                        lineItem
                            .on('mouseover', (e) => {
                                const line = d3.select(e.target.parentNode).classed('hovered', true);
                                const lineData = line.data();
                                d3.selectAll(`g#${lineData[0].source.id} circle`).classed('hovered', true);
                                d3.selectAll(`g#${lineData[0].target.id} circle`).classed('hovered', true);
                            })
                            .on('mouseout', (e) => {
                                const line = d3.select(e.target.parentNode).classed('hovered', false);
                                const lineData = line.data();
                                d3.selectAll(`g#${lineData[0].source.id} circle`).classed('hovered', false);
                                d3.selectAll(`g#${lineData[0].target.id} circle`).classed('hovered', false);
                            })
                            .on('click', (e) => {
                                const line = d3.select(e.target.parentNode).classed('hovered', true);
                                const lineData = line.data();
                                window.open(`http://river.cs.arizona.edu:1600/viz?src=${lineData[0].source.id.replace('_', ':')}&dst=${lineData[0].target.id.replace('_', ':')}&bidirect`, "_self")
                            });

                        // Reinitialize force
                        // const forces = ["link", 'charge', 'collide', 'center', 'forceX', 'forceY'];
                        // for(let i in forces) {
                        //     simulation.force(forces[i]).initialize(subgraph.nodes, () => 1);
                        // }

                        // simulation.alpha(0.5).alphaTarget(0.3).restart();

                        return lineGroup;
                    },
                    update => update,
                    exit => exit.remove()
                );

            const nodeRadiusRange = [
                Math.min(...subgraph.nodes.map(node => node.degree)), 
                Math.max(...subgraph.nodes.map(node => node.degree))
            ]
            const circleScale = d3.scaleLinear().domain(nodeRadiusRange).range([1, 10]);

            const categoryNodeColors = {
                3: "#8a2a44",
                4: "#10712b",
                1: "#411c58",
                2: "#00308e",
            }

            const node = svgNodeGroup
                .selectAll("g.node")
                .data(subgraph.nodes, d => d.id)
                .join(
                    enter => {
                        const nodeGroup = enter
                            .append("g")
                            .classed("node", true)
                            .classed("pinned", d => d['pinned'])
                            .attr('id', d => d.id);

                        nodeGroup.append("text")
                            .text(d => d["label"])
                            .attr('x', 10)
                            .attr('y', 5);
                        // node tooltip
                        nodeGroup.append("title")
                            .text(d => d.id);
                        

                        nodeGroup.append("circle")
                            .attr('r', d => circleScale(d.degree))
                            .attr('stroke', d => categoryNodeColors[d.category])
                            .on('mouseover', (e) => {
                                const circle = d3.select(e.target).classed('hovered', true);
                                const nodeId = circle.data()[0].id;
                                d3.selectAll('g.linkgroup g.' + nodeId).classed('hovered', true);

                                d3.selectAll('g.linkgroup g.' + nodeId + '.hovered text').classed('hovered', true);
                            })
                            .on('mouseout', (e) => {
                                const circle = d3.select(e.target).classed('hovered', false);
                                const nodeId = circle.data()[0].id;
                                d3.selectAll('g.linkgroup g.' + nodeId + '.hovered text').classed('hovered', false);
                                d3.selectAll('g.linkgroup g.' + nodeId).classed('hovered', false);

                            })
                            .on("click", (e) => {
                                window.open(`http://river.cs.arizona.edu:1600/viz?src=uniprot:P05231&dst=go:GO:0006954&bidirect`, '_self');

                            })
                        nodeGroup
                            // @ts-ignore
                            .call(d3.drag()
                                .on("start", (event, d) => {
                                    if (!event.active) simulation.alphaTarget(0.3).restart();
                                    d.fx = d.x;
                                    d.fy = d.y;

                                })
                                .on("drag", (event, d) => {
                                    d.fx = event.x;
                                    d.fy = event.y;

                                })
                                .on("end", (event, d) => {
                                    if (!event.active) simulation.alphaTarget(0.001);
                                    d.fx = null;
                                    d.fy = null;
                                }));

                        simulation.alpha(0.5).alphaTarget(0.3).restart();

                        return nodeGroup;
                    },
                    update => update,
                    exit => exit.remove()
                );


            simulation.nodes(subgraph.nodes);
            maxDist = Math.max(...subgraph.links.map(link => link.freq));

            simulation.force("link")
                .id(d => d.id)
                .links(subgraph.links);

            updateForces();


            simulation.on("tick", () => {
                link.selectAll('line')
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y);

                link.selectAll('text')
                    .attr('x', d => d.target.x + 20)
                    .attr('y', d => d.target.y + 20);

                node
                    .attr('transform', d => `translate(${d.x},${d.y})`);

                const hullPoints = [];
                for (let i = 1; i <= 4; i++) {
                    hullPoints.push({
                        category: i,
                        hulls: d3.polygonHull(subgraph.nodes.filter(d => d["category"] === i).map(d => [d.x, d.y]))
                    });
                }

                const hullPadding = 25;
                for(let i=1; i<=4; i++) {
                    d3.select('.hull_' + i).attr('d', smoothHull(hullPoints[i-1].hulls, hullPadding));
                }
                
                const entropyBar = d3.select('#alpha_value').style('width', simulation.alpha()*100 + "%");
                if(simulation.alpha() > 0.5) {
                    entropyBar.classed("bg-danger", true).classed("bg-warning", false).classed("bg-success", false);
                }
                else if(simulation.alpha() > 0.2) {
                    entropyBar.classed("bg-warning", true).classed("bg-danger", false).classed("bg-success", false);
                }
                else {
                    entropyBar.classed("bg-warning", false).classed("bg-danger", false).classed("bg-success", true);
                }
            });

            d3.select("#interclusterEdgeOpacity").on('change', (e) => {
                d3.selectAll("g.intracategory line").style('opacity', e.target.value);
            })
            d3.select("#intraclusterEdgeOpacity").on('change', (e) => {
                d3.selectAll("g.betweencategory line").style('opacity', e.target.value);
            })
            d3.select("#nodeLabelOpacity").on('change', (e) => {
                d3.selectAll("g.node text").style('opacity', e.target.value);
            })

            d3.selectAll(".clusternodecount").on('change', (e) => {
                const categoryIds = ['cluster1count', 'cluster2count', 'cluster3count', 'cluster4count'];
                setSelectedNode({
                    ...selectedNode,
                    category_count: { categorycount: {
                            "1": d3.select('#'+categoryIds[0]).property('value'),
                            "2": d3.select('#'+categoryIds[1]).property('value'),
                            "3": d3.select('#'+categoryIds[2]).property('value'),
                            "4": d3.select('#'+categoryIds[3]).property('value'),
                        }
                    }
                });
            });
        
            // Legends
            const colors = [
                { id: "Protein", color: "#d282beff" },
                { id: "Chemical", color: "#a6d9efff" },
                { id: "Biological Process", color: "#ffa770ff" },
                { id: "Diseases", color: "#e5f684ff" },
            ];

            const svgColorLegends = d3.select('g.categorylegends');
            const legendSquareSize = 20;
            svgColorLegends.selectAll('rect')
                .data(colors)
                .enter()
                .append('rect')
                .attr('x', 0)
                .attr('y', (d, i) => i * (legendSquareSize + 5))
                .attr('width', legendSquareSize)
                .attr('height', legendSquareSize)
                .style('fill', d => d.color);

            svgColorLegends.selectAll('text')
                .data(colors)
                .enter()
                .append("text")
                .attr("x", legendSquareSize * 1.2)
                .attr("y", (d, i) => i * (legendSquareSize + 5) + (legendSquareSize / 2))
                .style("fill", d => d.color)
                .text(d => d.id)
                .attr("text-anchor", "left")
                .style("alignment-baseline", "middle");

            const svgSizeLegends = d3.select('g.sizelegends');
            const sizeLegendItemsCount = 3;

            const linspace = (start, stop, num, endpoint = true) => {
                const div = endpoint ? (num - 1) : num;
                const step = (stop - start) / div;
                return Array.from({ length: num }, (_, i) => start + step * i);
            }

            const legendSizeData = Array.from(linspace(nodeRadiusRange[0], nodeRadiusRange[1], sizeLegendItemsCount), (d, i) => ({
                id: i, value: d
            }))
            const legendMaxCircleSize = circleScale(nodeRadiusRange[1]);

            svgSizeLegends.selectAll('circle')
                .data(legendSizeData, d => d.id)
                .join(enter => enter
                        .append('circle')
                        .attr('cx', 0)
                        .attr('cy', (d, i) => i * (legendMaxCircleSize*2))
                        .attr('r', d => circleScale(d.value))
                        .style('fill', d => "lightblue"),
                    update => update
                        .attr('cy', (d, i) => i * (legendMaxCircleSize*2))
                        .attr('r', d => circleScale(d.value)),
                    exit => exit.remove()
                );

            svgSizeLegends.selectAll('text')
                .data(legendSizeData, d => d.id)
                .join(enter => enter
                        .append("text")
                        .attr("x", legendMaxCircleSize * 2)
                        .attr("y", (d, i) => i * (legendMaxCircleSize*2))
                        .text(d => Math.round(d.value) + " degree")
                        .attr("text-anchor", "left")
                        .style("alignment-baseline", "middle"),
                    update => update
                        .attr("y", (d, i) => i * (legendMaxCircleSize*2))
                        .text(d => Math.round(d.value) + " degree"),
                    exit => exit.remove()
                );
        });

        const zoomHandler = d3.zoom()
            .on("zoom", (e) => {
                svg.attr('transform', e.transform)
            // @ts-ignore
            })(svgRoot);


        return cleanUp;
    }
    
    // React.useEffect(d3UpdateFunc);

    return <main className="main-ui">
        <div className="sidebar flex-shrink-0 p-3 bg-white">
            <h4>Entropy</h4>
            <div className="progress mb-5">
                <div id="alpha_value" className="progress-bar" role="progressbar" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100"></div>
            </div>
            <a href="/" className="d-flex align-items-center pb-3 mb-3 link-dark text-decoration-none border-bottom">
                <span className="fs-5 fw-semibold">Controls</span>
            </a>
            <ul className="list-unstyled ps-0">
                <li className="mb-1">
                    <button className="btn btn-toggle align-items-center rounded collapsed" data-bs-toggle="collapse" data-bs-target="#entity-collapse" aria-expanded="false">
                        Entity
                    </button>
                    <div className="collapse" id="entity-collapse">
                        <ul className="btn-toggle-nav list-unstyled fw-normal pb-1 small">
                            <li>
                                <EntityAutoComplete fromEntityAutoComplete={updateNodeSuggestions} />
                            </li>
                            <li>
                                <label htmlFor="cluster1count" className="form-label">Protein Entity Count</label>
                                <input type="number" className="form-control clusternodecount" min="3" max="50" step="1" id="cluster1count" defaultValue="5" />
                            </li>
                            <li>
                                <label htmlFor="cluster2count" className="form-label">Disease Entity Count</label>
                                <input type="number" className="form-control clusternodecount" min="3" max="50" step="1" id="cluster2count" defaultValue="5" />
                            </li>
                            <li>
                                <label htmlFor="cluster3count" className="form-label">Chemical Entity Count</label>
                                <input type="number" className="form-control clusternodecount" min="3" max="50" step="1" id="cluster3count" defaultValue="5" />
                            </li>
                            <li>
                                <label htmlFor="cluster4count" className="form-label">Disease Entity Count</label>
                                <input type="number" className="form-control clusternodecount" min="3" max="50" step="1" id="cluster4count" defaultValue="5" />
                            </li>
                        </ul>
                    </div>
                </li>
                <li className="mb-1">
                    <button className="btn btn-toggle align-items-center rounded collapsed" data-bs-toggle="collapse" data-bs-target="#visual-collapse" aria-expanded="false">
                        Visual
                    </button>
                    <div className="collapse" id="visual-collapse">
                        <ul className="btn-toggle-nav list-unstyled fw-normal pb-1 small">
                            <li>
                                <label htmlFor="interclusterEdgeOpacity" className="form-label">Inter Category Link Opacity</label>
                                <input type="range" className="form-range" min="0" max="1" step="0.01" id="interclusterEdgeOpacity" defaultValue="0.1" />
                            </li>
                            <li>
                                <label htmlFor="intraclusterEdgeOpacity" className="form-label">Between Category Link Opacity</label>
                                <input type="range" className="form-range" min="0" max="1" step="0.01" id="intraclusterEdgeOpacity" defaultValue="0.1" />
                            </li>
                            <li>
                                <label htmlFor="nodeLabelOpacity" className="form-label">Entity Label Opacity</label>
                                <input type="range" className="form-range" min="0" max="1" step="0.01" id="nodeLabelOpacity" defaultValue="0.1" />
                            </li>
                        </ul>
                    </div>
                </li>
                <li className="mb-1">
                    <button className="btn btn-toggle align-items-center rounded collapsed" data-bs-toggle="collapse" data-bs-target="#dashboard-collapse" aria-expanded="false">
                        Graph Parameters
                    </button>
                    <div className="collapse" id="dashboard-collapse">
                        <ul className="btn-toggle-nav list-unstyled fw-normal pb-1 small">
                            <li>
                                <div className="form-check form-switch m-3">
                                    <input type="checkbox" className="form-check-input" id="simulationenabled" defaultChecked={true} onChange={e => {
                                        if (e.target.checked) simulation.alpha(1).restart();
                                        else simulation.stop();
                                    }} />
                                    <label className="form-check-label" htmlFor="simulationenabled"><b>Simulation</b></label>
                                </div>
                            </li>
                            <li>
                                <label htmlFor="graphparamsepfactor" className="form-label">Separation Factor</label>
                                <input type="range" className="form-range" min="0" max="1" step="0.01" id="graphparamsepfactor" defaultValue="0.1" onChange={e => {
                                    forceProperties.separation.strength = parseFloat(e.target.value);
                                    updateForces();
                                }} />
                            </li>
                            <li>
                                <label htmlFor="linkstrength" className="form-label">Link Strength</label>
                                <input type="range" className="form-range" min="0" max="1" step="0.01" id="linkstrength" defaultValue="0.9" onChange={e => {
                                    forceProperties.link.strength = parseFloat(e.target.value);
                                    updateForces();
                                }} />
                            </li>
                        </ul>
                    </div>
                </li>
                <li className="border-top my-3"></li>
                <li className="mb-1">
                    <button className="btn btn-toggle align-items-center rounded collapsed" data-bs-toggle="collapse" data-bs-target="#account-collapse" aria-expanded="false">
                        Others
                    </button>
                    <div className="collapse" id="account-collapse">
                        <ul className="btn-toggle-nav list-unstyled fw-normal pb-1 small">
                            <li><a href="#" className="link-dark rounded">Others</a></li>
                        </ul>
                    </div>
                </li>
            </ul>
        </div>
        <div className="mainview">
            <div className="mainview-drawings">
                <svg ref={svgRef} id="maingraph" className="maingraph" height={height} width={width} >
                    <g className="everything">
                        <g className="hullgroup"></g>
                        <g className="linkgroup"></g>
                        <g className="nodegroup"></g>
                        <g className="legendgroup">
                            <g className="categorylegends" transform={`translate(${width - 200},25)`}></g>
                            <g className="sizelegends" transform={`translate(${width - 200},160)`}></g>
                        </g>
                    </g>
                </svg>
            </div>
        </div>
    </main>


}

export default MainGraph;