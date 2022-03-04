from fastapi import FastAPI
from starlette.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel

import difflib

import pickle
import networkx as nx

# Data loading and preprocessing
with open('../data/graph_rahat.pickle', 'rb') as f:
    data = pickle.load(f)

categories = {
	"uniprot": "Proteins or Gene Products",
	"mesh": "Diseases",
	"go": "Biological Process",
	"fplx": "Proteins or Gene Products",
	"pubchem": "Chemicals",
	"interpro": "Proteins or Gene Products",
	"proonto": "Proteins or Gene Products",
	"chebi": "Chemicals",
	"pfam": "Proteins or Gene Products",
	"frailty": "Biological Process"
}
category_encoding = {
    1: 'Proteins or Gene Products',
    2: 'Diseases',
    3: 'Biological Process',
    4: 'Chemicals'
}
category_encoding_rev = {v: k for k, v in category_encoding.items()}


def get_category_name_from_id(node_id):
    return categories[node_id.split('_')[0]]


def get_category_number_from_id(node_id):
    return category_encoding_rev[get_category_name_from_id(node_id)]


# Creating no-self-loop and singly-graph variants
G_no_selfloop = data.copy()
G_no_selfloop.remove_edges_from(nx.selfloop_edges(G_no_selfloop))
G_se = nx.DiGraph()
G_se.add_nodes_from(G_no_selfloop.nodes.data())
edges = {
    (u, v): 0 for u, v, i in G_no_selfloop.edges
}
for i, (u, v, d) in enumerate(G_no_selfloop.edges.data()):
    if 'freq' in d:
        edges[(u, v)] += d['freq']
    else:
        edges[(u, v)] += 1
for k, v in edges.items():
    G_se.add_edge(k[0], k[1], freq=v)

max_freq = max([d[2]['freq'] for d in G_se.edges.data()])

chars = {
    ':': '_',
    '-': '_'
}
mapping = {}
for node in G_se.nodes:
    new_node = node
    for k, v in chars.items():
        if k in new_node:
            new_node = v.join(node.split(k))
            mapping[node] = new_node

G_se = nx.relabel_nodes(G_se, mapping)
# Reverse graph: To calculate incident edges of X
G_se_rev = G_se.reverse()

# Pre calculating the nodes
nodes = []
for node in list(data.nodes.data()):
    if 'label' not in node[1]:
        node[1]['label'] = node[0]
    nodes.append({
        'id': node[0].strip(),
        'label': node[1]['label'].strip(),
        'category': categories[node[0].split(':')[0]]
    })

# Flask APP
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class NodesList(BaseModel):
    nodes: list[str]


@app.get("/")
async def hello_world():
    return RedirectResponse(url='/docs')


class CategoryCount(BaseModel):
    categorycount: dict[int, int]

@app.post('/getbestsubgraph')
async def getbestsubgraph(nodes: NodesList, category_count: CategoryCount):
    '''
    Request type
    {
        "nodes": {
            "nodes": [
            "uniprot:Q92504", "uniprot:Q0CJ54"
            ]
        },
        "category_count": {
            "categorycount": {
            "1": 10,
            "2": 10,
            "3": 15,
            "4": 20
            }
        }
    }
    '''
    nodes = nodes.nodes
    category_count = category_count.categorycount

    # O(number of cat * cat_1 * cat_2 * ... * cat_n * 2NlogN * \sum{cat_i})
    catFinalList = {}
    for cat_id, cat_count in category_count.items():
        finalList = [{
            'id': node,
            'freq': max_freq+1,
            'pinned': True
        } for node in nodes if get_category_number_from_id(node) == cat_id]
        for node in nodes:
            neighbors = list(map(lambda d: {
                'id': d[0],
                'freq': d[1]['freq'],
                'pinned': False
            }, filter(lambda x: get_category_number_from_id(x[0]) == cat_id, dict(G_se[node]).items())))
            to_neighbors = sorted(neighbors, key=lambda x: x['freq'], reverse=True)[
                :cat_count]

            neighbors = list(map(lambda d: {
                'id': d[0],
                'freq': d[1]['freq'],
                'pinned': False
            }, filter(lambda x: get_category_number_from_id(x[0]) == cat_id, dict(G_se_rev[node]).items())))
            from_neighbors = sorted(neighbors, key=lambda x: x['freq'], reverse=True)[
                :cat_count]

            seen = set(list(map(lambda x: x['id'], finalList))+nodes)
            for e in (to_neighbors+from_neighbors):
                found = e
                if e['id'] in seen:
                    found_i = next((i for (i, d) in enumerate(
                        finalList) if d['id'] == e['id']), None)
                    if not found_i:
                        finalList.append(e)
                        continue
                    found = finalList.pop(found_i)
                    found = found if found['freq'] >= e['freq'] else e
                finalList.append(found)
                seen.add(found['id'])
        catFinalList[cat_id] = sorted(finalList, key=lambda x: x['freq'], reverse=True)[:cat_count]

    finalNodes = []
    for v in catFinalList.values():
        finalNodes += v

    subgraph = G_se.subgraph(map(lambda x: x['id'], finalNodes))

    return {
        'nodes': list(map(lambda x: {
            'id': x[0],
            'category': get_category_number_from_id(x[0]),
            'label': d['label'] if 'label' in (d := x[1]) else x[0],
            'pinned': next(filter(lambda d: d['id']==x[0], catFinalList[get_category_number_from_id(x[0])]))['pinned'],
            'degree': G_se.degree(x[0])
        }, subgraph.nodes.data())),
        'links': list(map(lambda x: {
            'source': x[0],
            'target': x[1],
            'freq': x[2]['freq'] if 'freq' in x[2] else 1,
            'samecategory': get_category_number_from_id(x[0]) == get_category_number_from_id(x[1])
        }, subgraph.edges.data())),
    }


@app.get("/searchnode/{node_text}/{n}")
async def searchnode(node_text: str, n: int):
    # https://stackoverflow.com/questions/10018679/python-find-closest-string-from-a-list-to-another-string
    search_space = set(list(G_se.nodes) + list(map(lambda x: x[1]["label"].strip(
    ), filter(lambda x: "label" in x[1], G_se.nodes.data()))))
    results = difflib.get_close_matches(node_text, search_space, n=n)

    ret = []
    for r in results:
        node = next(filter(lambda x: x[0] == r, G_se.nodes.data()), None)
        if not node:
            node = next(filter(lambda x: 'label' in x[1] and x[1]['label'].strip(
            ) == r, G_se.nodes.data()), None)
        ret.append({
            "id": node[0],
            "label": node[1]['label'] if 'label' in node[1] else node[0],
            'category': get_category_number_from_id(node[0])
        })

    return {
        "matches": ret
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
