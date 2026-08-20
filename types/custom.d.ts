declare module 'react-dom' {
  export function createPortal(children: React.ReactNode, container: Element | DocumentFragment | null, key?: string | null): React.ReactPortal;
  export function render(element: any, container: any, callback?: any): any;
  export function unmountComponentAtNode(container: any): boolean;
  export function findDOMNode(instance: any): any;
  export const version: string;
}
