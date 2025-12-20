import type { WebSocket } from 'ws';

class Commands {
 private   commandList  = {
} as Record<string,(data?:commandInputData)=>Promise<void|unknown>>

private socketEvents:Record<string,(payload:any,ws:WebSocket,)=>void> = {}

private socket?: WebSocket

public initWebSocket (webSocket:WebSocket){
this.socket =webSocket
this.socket.on('message',(rawData)=>{

    if (this.socket == null) {

        throw new Error("socket is empty initWebSocket ");
        
    }
    const  {event,data} = JSON.parse(rawData.toString())
    const callback =  this.socketEvents[event]
    if (callback) {
        callback(data,this.socket)
    }else{
        this.socket.send(JSON.stringify({event:"error",data:`${event} was not found 404`}))
    }
})
}

public  sendMessage (event:string,payload:any){
    if (this.socket == null) {
        
        throw new Error("socket not initiated");
        
    }
    this.socket.send(JSON.stringify({event:event,data:payload}))

}
public runSocketEvents (event:string,callback:<T>(payload:any,ws:WebSocket,)=>(Promise<void>|void)){
this.socketEvents[event] = callback
}

}


export function useCommand (){
return new Commands()
}


export type CommandData =  {
    cmd:(data?:commandInputData)=>Promise<void|unknown>,
    description?:string
}
export const commandList  = {
 
} as Record<string,(data?:commandInputData)=>Promise<void|unknown>>
type commandInputData  =Record<string,unknown>|null|undefined
export function registerCommand(command:string, callBack:(data:commandInputData)=>Promise<void|unknown>) {
    commandList[command] = callBack
}


export async function runCommand({callback,command,input}:{command:string , input?:commandInputData,callback:(<T>(commandResp:T)=>void)}) {
    const cmd = commandList[command]
    if (cmd == undefined) {
        return  {
            error:true,
            details:'command not found in the register'
        }
    }

    try {
     const output =  await   cmd(input)
     callback(output)
     return {
        error:false,
        details:'command ok',
        data:output
     }

    } catch (error) {
        return {
            error:true,
            details:`error running command  ${command} ==> ${error} `
        }
    }
    


}

