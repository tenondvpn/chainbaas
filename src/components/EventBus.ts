// eventBus.ts
import mitt from 'mitt';

// 定义事件类型和载荷类型
type EventTypes = {
  'update_graph': {  };
  'show_update_graph': {  };
  'success_create_pipeline': {};
  'success_update_pipeline': {};
  'success_delete_pipeline': {};
  'success_create_task': {};
  'home_view_click_create_pipeline': {};
  'click_show_pipeline': {};
  'delete_task_success': {};
  'update_task_success': {};
  'graph_call_delete_pipeline': {};
  'success_load_task_table_data': {};
  'reload_task_table_data_with_page': {};
  'reload_task_table_data_with_page_size': {};
  'auto_refresh_task_table_data': {};
  'table_order_changed': {};
  'table_selected_changed': {};
  'user_refresh_table_data': {};
  'batch_run_table_tasks': {};
  'batch_stop_table_tasks': {};
  'update_history_graph': {},
  'show_menu': {},
  'success_run_tasks': {},
  'export_graph': {},
  'create_folder': {},
  'update_folder': {},
  'upate_processor_to_show_detail': {},
  'ai_generate': {},
  'update_processor_success': {}
  'create_processor_success': {}
  'delete_processor_success': {}
  'click_upadate_processor': {}
  'click_delete_processor': {}
  'home_view_click_create_processor': {}
  'share_processor_success': {}
  'success_upload_processor': {}
  'change_el_menu_item': {},
  'show_graph_called': {},
  'update_soldity_height': {},
  'update_soldity_status_height': {},
  'compile_solidity_code': {},
  'compile_solidity_code_res': {},
  'deploy_solidity_code': {},
  'deploy_solidity_code_res': {},
  'call_function_solidity_code': {},
  'call_function_solidity_code_res': {},
  'set_solidity_private_key': {},
  'theme_changed': {},
  'change_search_status': {},
  'change_search_owner': {},
};

const emitter = mitt<EventTypes>();
export default emitter;
