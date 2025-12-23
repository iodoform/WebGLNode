import { Node } from '../../domain/entities/Node';
import { Socket } from '../../domain/entities/Socket';

/**
 * 入力フィールドのレンダリングを担当するクラス
 * 
 * ノードの入力ソケットに表示する入力フィールド（数値入力、ベクトル入力、カラーピッカーなど）を
 * 作成・管理します。ソケットの型に応じて適切なUI要素を生成し、値の変更を処理します。
 */
export class InputFieldRenderer {
  constructor(
    private isSocketConnected: (socketId: string) => boolean,
    private triggerShaderUpdate: () => void,
    private updateNodeValue: (nodeId: string, name: string, value: number | number[]) => void
  ) {}

  createInputField(socket: Socket, node: Node): HTMLElement {
    // Special handling for color type - show color picker
    if (socket.type === 'color') {
      return this.createColorInput(socket, node);
    }
    
    // Handle vector types (vec2, vec3, vec4) - show multiple input fields
    const vectorDimensions: Record<string, number> = {
      'vec2': 2,
      'vec3': 3,
      'vec4': 4,
    };
    
    const dimensions = vectorDimensions[socket.type];
    if (dimensions) {
      return this.createVectorInput(socket, node, dimensions);
    }
    
    // Single float input
    const input = document.createElement('input');
    input.className = 'node-input-field';
    input.type = 'number';
    input.step = '0.1';
    
    const value = node.getValue(socket.name);
    if (Array.isArray(value)) {
      input.value = String(value[0] ?? 0);
    } else {
      input.value = String(value ?? 0);
    }

    input.addEventListener('change', () => {
      const newValue = parseFloat(input.value) || 0;
      const currentValue = node.getValue(socket.name);
      if (Array.isArray(currentValue)) {
        const newArray = [...currentValue];
        newArray[0] = newValue;
        this.updateNodeValue(node.id.value, socket.name, newArray);
      } else {
        this.updateNodeValue(node.id.value, socket.name, newValue);
      }
      this.triggerShaderUpdate();
    });

    input.addEventListener('mousedown', (e) => e.stopPropagation());

    return input;
  }

  createVectorInput(socket: Socket, node: Node, dimensions: number): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'node-vector-input-wrapper';
    
    const componentLabels = ['X', 'Y', 'Z', 'W'];
    
    // Get current value
    let currentValue = node.getValue(socket.name);
    if (!Array.isArray(currentValue)) {
      const singleValue = currentValue ?? 0;
      currentValue = Array(dimensions).fill(singleValue);
      this.updateNodeValue(node.id.value, socket.name, currentValue);
    }
    
    const valueArray = currentValue as number[];
    
    for (let i = 0; i < dimensions; i++) {
      const row = document.createElement('div');
      row.className = 'node-vector-input-row';
      
      const label = document.createElement('span');
      label.className = 'node-vector-component-label';
      label.textContent = componentLabels[i];
      row.appendChild(label);
      
      const input = document.createElement('input');
      input.className = 'node-input-field node-vector-input-field';
      input.type = 'number';
      input.step = '0.1';
      input.value = String((valueArray as number[])[i] ?? 0);
      
      input.addEventListener('change', () => {
        const newValue = parseFloat(input.value) || 0;
        const current = node.getValue(socket.name);
        let newArray: number[];
        if (!Array.isArray(current)) {
          newArray = Array(dimensions).fill(0);
        } else {
          newArray = [...current];
        }
        newArray[i] = newValue;
        this.updateNodeValue(node.id.value, socket.name, newArray);
        this.triggerShaderUpdate();
      });
      
      input.addEventListener('mousedown', (e) => e.stopPropagation());
      
      row.appendChild(input);
      wrapper.appendChild(row);
    }
    
    return wrapper;
  }

  createColorInput(socket: Socket, node: Node): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'node-color-input-wrapper';
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'node-color-picker';
    
    // Get current color value
    const value = node.getValue(socket.name);
    let r = 0, g = 0, b = 0;
    if (Array.isArray(value)) {
      r = Math.round(Math.max(0, Math.min(1, value[0] ?? 0)) * 255);
      g = Math.round(Math.max(0, Math.min(1, value[1] ?? 0)) * 255);
      b = Math.round(Math.max(0, Math.min(1, value[2] ?? 0)) * 255);
    }
    colorInput.value = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    
    colorInput.addEventListener('input', () => {
      const hex = colorInput.value;
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      this.updateNodeValue(node.id.value, socket.name, [r, g, b]);
      this.triggerShaderUpdate();
    });

    colorInput.addEventListener('mousedown', (e) => e.stopPropagation());
    colorInput.addEventListener('click', (e) => e.stopPropagation());

    wrapper.appendChild(colorInput);
    return wrapper;
  }

  createNodeColorPicker(node: Node): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'node-color-picker-wrapper';
    
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'node-large-color-picker';
    
    // Initialize color value if not set
    let value = node.getValue('_color');
    if (!value) {
      value = [1, 1, 1];
      this.updateNodeValue(node.id.value, '_color', value);
    }
    
    const valueArray = (Array.isArray(value) ? value : [value, value, value]) as number[];
    const r = Math.round(Math.max(0, Math.min(1, valueArray[0])) * 255);
    const g = Math.round(Math.max(0, Math.min(1, valueArray[1])) * 255);
    const b = Math.round(Math.max(0, Math.min(1, valueArray[2])) * 255);
    colorInput.value = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    
    colorInput.addEventListener('input', () => {
      const hex = colorInput.value;
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      this.updateNodeValue(node.id.value, '_color', [r, g, b]);
      this.triggerShaderUpdate();
    });

    colorInput.addEventListener('mousedown', (e) => e.stopPropagation());
    colorInput.addEventListener('click', (e) => e.stopPropagation());

    wrapper.appendChild(colorInput);
    return wrapper;
  }

  updateNodeInputFields(
    _nodeId: string,
    node: Node,
    nodeEl: HTMLElement
  ): void {
    // Find all input rows and update their input fields
    const inputRows = nodeEl.querySelectorAll('.node-input-row');
    inputRows.forEach((row, index) => {
      const input = node.inputs[index];
      if (!input) return;

      const rightSide = row.querySelector('.node-input-right-side');
      if (!rightSide) return;

      // Remove existing input field
      const existingInput = rightSide.querySelector('.node-input-field, .node-color-input-wrapper, .node-vector-input-wrapper');
      if (existingInput) {
        existingInput.remove();
      }

      // Add input field if not connected
      if (!this.isSocketConnected(input.id.value)) {
        if (input.type === 'color') {
          rightSide.appendChild(this.createColorInput(input, node));
        } else {
          rightSide.appendChild(this.createInputField(input, node));
        }
      }
    });
  }
}

