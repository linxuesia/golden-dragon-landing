const startButton=document.querySelector('#startButton');
const statusDot=document.querySelector('#statusDot');
const statusText=document.querySelector('#statusText');
const logList=document.querySelector('#logList');
const logCount=document.querySelector('#logCount');
let count=0,nextAction='start';
const levelNames={info:'信息',success:'成功',error:'错误'};
function setState(state,text,action='start'){statusDot.className=`status-dot ${state==='idle'?'':state}`;statusText.textContent=text;nextAction=action;const busy=state==='running';startButton.disabled=busy;startButton.querySelector('span').textContent=busy?action==='install'?'正在安装':'正在运行':action==='install'?'安装影刀':action==='fallback'?'使用热键重试':'启动自动化'}
function appendLog(entry){document.querySelector('.empty-log')?.remove();const row=document.createElement('p');row.className='log-entry';row.dataset.level=entry.level||'info';const time=document.createElement('span');time.className='log-time';time.textContent=entry.time||new Date().toLocaleTimeString('zh-CN',{hour12:false});const level=document.createElement('span');level.className='log-level';level.textContent=levelNames[entry.level]||levelNames.info;const message=document.createElement('span');message.className='log-message';message.textContent=entry.message;row.append(time,level,message);logList.append(row);logList.scrollTop=logList.scrollHeight;count+=1;logCount.textContent=`${count} 条`}
if(!window.automation)appendLog({level:'info',message:'当前为浏览器预览模式。请使用 npm run app 启动桌面客户端。'});
window.automation?.onLog(appendLog);
window.automation?.onState(({state,text,action})=>setState(state,text,action));
startButton.addEventListener('click',async()=>{const action=nextAction;setState('running',action==='install'?'正在安装影刀':action==='fallback'?'正在发送热键':'正在启动',action);try{if(!window.automation)throw new Error('浏览器预览模式不能启动本地自动化');if(action==='install'){await window.automation.install();appendLog({level:'success',message:'影刀安装完成，请打开影刀并人工登录'});return}if(action==='fallback'){await window.automation.fallback();appendLog({level:'success',message:'热键降级指令已发送'});return}const result=await window.automation.start();if(result.fallbackRequired){setState('error','UUID 启动失败','fallback');return}appendLog({level:'success',message:`任务已下发：${result.jobId}`})}catch(error){appendLog({level:'error',message:error.message||String(error)});setState('error',action==='install'?'安装未完成':'启动失败',action)}});
