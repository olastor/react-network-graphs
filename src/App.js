import React, { Component } from 'react';
import './App.css';
import CytoscapeComponent from 'react-cytoscapejs';
import { Button } from '@material-ui/core';

const stylesheet = [
  {
    selector: 'edge',
    style: {
      'label': 'data(label)',
      'target-arrow-shape': 'triangle',
      'target-arrow-color': '#ccc',
      'line-color': '#ccc',
      'target-endpoint': 'outside-to-line',
      'curve-style': 'bezier'
    }
  },
  {
    selector: 'node',
    style: {
      'label': 'data(label)',
      'text-valign': 'center',
      'text-halign': 'center'
    }
  },
  {
    selector: '.labeled',
    style: {
      'border-width': 3,
      'border-color': 'green'
    }
  },
  {
    selector: '.scanned',
    style: {
      'background-color': 'blue'
    }
  },
  {
    selector: '.marked-edge',
    style: {
      'line-color': 'black',
      'target-arrow-color': 'black',
    }
  }
];

class App extends Component {

  constructor (props) {
    super(props);

    this.state = {
      network: {
        // 0 is source, 5 is sink
        numberOfNodes: 6,
        edges: [
          // [nodeFrom, NodeTo, flow, capacity]
          [0, 1, 0, 5],
          [0, 2, 0, 6],
          [1, 3, 0, 1],
          [1, 4, 0, 2],
          [2, 4, 0, 1],
          [3, 5, 0, 2],
          [4, 5, 0, 3]
        ]
      },
      intermediateStep: false, // flag add an intermediate step to mark augmenting path
      nodesLabeled: [0],
      nodesScanned: [],
      nodesPre: {},
      nodePositions: {
        0: {x : 0, y: 50},
        1: {x : 100, y: 0},
        2: {x : 100, y: 100},
        3: {x : 200, y: 0},
        4: {x : 200, y: 100},
        5: {x : 300, y: 50}
      },
      stepCounter: 0,
      terminated: false,
      previousStates: []
    };
  }

  /**
   * Creates data structure for drawing network with cytoscape.
   */
  toCytoscapeNetwork () {
    return [
      // nodes
      ...new Array(this.state.network.numberOfNodes).fill(undefined).map((_, i) => ({
        data: { id: i, label: i === 0 ? 's' : (i === this.state.network.numberOfNodes - 1 ? 't' : i) },
        position: this.state.nodePositions[i],
        classes: `${this.state.nodesLabeled.includes(i) ? 'labeled ' : ''}${this.state.nodesScanned.includes(i) ? 'scanned ' : ''}`
      })),
      // edges
      ...this.state.network.edges.map(([nodeFrom, nodeTo, flow, capacity]) => ({
        data: {
          source: nodeFrom,
          target: nodeTo,
          label: `${flow}/${capacity}`
        },
        classes: this.state.nodesPre[nodeTo] === nodeFrom ? 'marked-edge' : ''
      }))
    ];
  }

  /**
   * Creates data structure for drawing residual network with cytoscape.
   */
  toCytoscapeResidual () {
    return [
      // nodes
      ...new Array(this.state.network.numberOfNodes).fill(undefined).map((_, i) => ({
        data: { id: i, label: i === 0 ? 's' : (i === this.state.network.numberOfNodes - 1 ? 't' : i) },
        position: this.state.nodePositions[i],
        classes: `${this.state.nodesLabeled.includes(i) ? 'labeled ' : ''}${this.state.nodesScanned.includes(i) ? 'scanned ' : ''}`
      })),
      // edges
      ...this.state.network.edges.map(([nodeFrom, nodeTo, flow, capacity]) => ({
        data: {
          source: nodeFrom,
          target: nodeTo,
          label: `${capacity - flow}`
        },
        classes: this.state.nodesPre[nodeTo] === nodeFrom ? 'marked-edge' : ''
      })),
      ...this.state.network.edges.map(([nodeFrom, nodeTo, flow, capacity]) => ({
        data: {
          source: nodeTo,
          target: nodeFrom,
          label: `${flow}`
        }
      }))
    ];
  }

  handlePrevStep() {
    this.setState(state => state.previousStates[0])
  }

  handleNextStep() {
    if (this.state.terminated) return;

    const t = this.state.network.numberOfNodes - 1;

    this.setState(state => ({ previousStates: [state, ...state.previousStates] }));

    if (this.state.nodesLabeled.includes(t)) {
      // augment
      let augmentingPath = [ t ];
      let currentNode = t;
      while (currentNode !== 0) {
        currentNode = this.state.nodesPre[currentNode];
        augmentingPath = [ currentNode, ...augmentingPath ];
      }

      // find maximum augmentation
      const allResidualCapacitiesOnPath = [];
      for (let i = 0; i < augmentingPath.length; i++) {
        for (let [nodeFrom, nodeTo, flow, capacity] of this.state.network.edges) {
          if (nodeFrom === augmentingPath[i] && nodeTo === augmentingPath[i+1]) {
            allResidualCapacitiesOnPath.push(capacity - flow);
            break;
          }
        }
      }
      const maximumAugmentation = Math.min(...allResidualCapacitiesOnPath);

      // augment path
      for (let i = 0; i < augmentingPath.length; i++) {
        for (let [nodeFrom, nodeTo, flow, capacity] of this.state.network.edges) {
          if (nodeFrom === augmentingPath[i] && nodeTo === augmentingPath[i+1]) {
            this.setState((state) => ({
              network: {
                ...state.network,
                edges: [
                  ...state.network.edges.filter(([n1, n2, ...r]) => !(n1 === nodeFrom && n2 === nodeTo)),
                  [nodeFrom, nodeTo, flow + maximumAugmentation, capacity]
                ]
              }
            }))
            break;
          }
        }
      }

      // reset
      this.setState((state) => {
        const tempState = {
          nodesPre: {},
          nodesLabeled: [ 0 ],
          nodesScanned: [],
          intermediateStep: true
        };
        console.log('PATH', augmentingPath)
        for (let i = 0; i < augmentingPath.length; i++) {
          for (let [nodeFrom, nodeTo, flow, capacity] of this.state.network.edges) {
            if (nodeFrom === augmentingPath[i] && nodeTo === augmentingPath[i+1]) {
              tempState.nodesPre[nodeTo] = nodeFrom;
              break;
            }
          }
        }

        console.log('HIER', tempState);

        return tempState;
      });
    } else {
      // label
      if (this.state.intermediateStep) {
        // reset nodesPre if intermediate step flag is set
        this.setState({
          intermediateStep: false,
          nodesPre: {}
        });
        return;
      }

      const i = this.state.nodesLabeled.filter(x => !this.state.nodesScanned.includes(x))[0];

      if (i === undefined) {
        this.setState({ terminated: true });
        return;
      }

      // scan all nodes that
      //   - can be reached from i,
      //   - via a flow > 0,
      //   - and are unlabeld
      this.state.network.edges.map(([nodeFrom, nodeTo, flow, capacity]) => {
        if (nodeFrom !== i || capacity - flow <= 0 || this.state.nodesLabeled.includes(nodeTo)) {
          return;
        }

        this.setState((state) => ({
          nodesLabeled: [...state.nodesLabeled, nodeTo],
          nodesPre: {
            ...state.nodesPre,
            [nodeTo]: i
          }
        }));
      });

      this.setState((state) => ({
        nodesScanned: [...state.nodesScanned, i]
      }), state => console.log(this.state));
    }

    this.setState(state => ({ stepCounter: state.stepCounter + 1 }));
  }

  convertSetOfNodesToLabels (nodes) {
    return nodes.map(x => x.toString().replace('0', 's').replace((this.state.network.numberOfNodes - 1).toString(), 't'));
  }

  render () {
    const layout = { name: 'preset' };
    return (
      <div>
        <Button onClick={() => this.handlePrevStep()}>Prev Step</Button>
        <Button onClick={() => this.handleNextStep()}>Next Step</Button>
        <span>Step: <b>{this.state.stepCounter}</b> {this.state.terminated ? '(TERMINATED)' : ''}</span>
        <span>LABELED: {JSON.stringify(this.convertSetOfNodesToLabels(this.state.nodesLabeled))}</span>
        <span>SCANNED: {JSON.stringify(this.convertSetOfNodesToLabels(this.state.nodesScanned))}</span>
        <div style={{ display: 'flex', width: '100%', height: 'calc(100% - 100px)'}}>
          <CytoscapeComponent
            elements={this.toCytoscapeNetwork()}
            layout={layout}
            stylesheet={stylesheet}
            style={ { width: '100%', height: window.innerHeight } }
          />
          <CytoscapeComponent
            elements={this.toCytoscapeResidual()}
            layout={layout}
            stylesheet={stylesheet}
            style={ { width: '100%', height: window.innerHeight } }
          />
        </div>
      </div>
    );
  }
}

export default App;
