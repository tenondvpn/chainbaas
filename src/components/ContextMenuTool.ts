import { ToolsView } from '@antv/x6'
import { h, render } from 'vue'
import { ElMenu, ElMenuItem } from 'element-plus'

export class ContextMenuTool extends ToolsView.ToolItem {
  private timer: number
  private onMouseDown = () => {
    this.timer = window.setTimeout(() => {
      this.toggleMenu(false)
    }, 200)
  }

  private toggleMenu(visible: boolean, e?: MouseEvent) {
    render(null, this.container)
    document.removeEventListener('mousedown', this.onMouseDown)
    
    if (visible && e) {
      const menuItems = this.options.menu.map(item => 
        h(ElMenuItem, {
          key: item.key,
          onClick: () => item.action(this.cellView)
        }, () => item.label)
      )
      
      const menu = h(ElMenu, {
        style: {
          position: 'fixed',
          left: `${e.clientX}px`,
          top: `${e.clientY}px`,
          'box-shadow': '0 2px 12px 0 rgba(0,0,0,.1)'
        }
      }, menuItems)

      render(menu, this.container)
      document.addEventListener('mousedown', this.onMouseDown)
    }
  }
}
