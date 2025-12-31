/**
 * ソケットの型を表す値オブジェクト
 * 
 * vec2はvec3として扱われます（z成分は0）。
 * vec4は使用しません。vec4が必要な場合はvec3とwを別々の入力として扱います。
 */
export type SocketType = 'float' | 'vec3' | 'color' | 'sampler' | 'texture2d';

/**
 * ソケットの方向を表す値オブジェクト
 */
export type SocketDirection = 'input' | 'output';

