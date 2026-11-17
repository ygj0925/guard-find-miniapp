import { http } from '@/http/http'
export interface OpsSettings { operator:string,contact:string,policyVersion:string,effectiveDate:string,policiesPublished:boolean,userAgreement:string,privacyPolicy:string,subscriptionEnabled:boolean,templateId:string }
export interface Reception { managerId?:string|null,managerName?:string,availability:'ACTIVE'|'RENTED'|'SOLD'|'PAUSED',reason?:string,reopenDate?:string,latitude?:number|null,longitude?:number|null,meetingPoint?:string,instructions?:string }
export interface BookingLog { id:string,actorType:string,action:string,reason?:string,fromStatus:number|null,toStatus:number,createTime:string }
export interface BookingDetail { id:string,propertyId:string,userId:string,ownerId?:string|null,bookingTime:string,contactName:string,contactPhone:string,remark?:string,status:number,statusLabel:string,canManage:boolean,isGuest:boolean,reception:Reception,property:{id:string,title:string,address:string}[],logs:BookingLog[] }
export const bookingLabels:Record<number,string>={1:'待确认',2:'已确认',3:'已拒绝',4:'已取消',5:'已到访',6:'已完成',7:'未到访',8:'已过期'}
export const availabilityLabels={ACTIVE:'正常接待',RENTED:'已出租',SOLD:'已售出',PAUSED:'暂停接待'}
export function fetchOpsSettings(){return http.get<OpsSettings>('/miniapp/property/operations/settings',undefined,undefined,{skipAuth:true})}
export function fetchReception(id:string){return http.get<Reception>(`/miniapp/property/${id}/operations`)}
export function startConsult(id:string,support=true){return http.post<void>(`/miniapp/property/${id}/consult`,undefined,{support})}
export function fetchBookingDetail(id:string){return http.get<BookingDetail>(`/miniapp/property/operations/booking/${id}`)}
export function actOnBooking(id:string,data:{action:string,reason?:string,bookingTime?:string}){return http.post<void>(`/miniapp/property/operations/booking/${id}/action`,data)}
export function subscribeBooking(id:string,templateId:string){return http.post<void>(`/miniapp/property/operations/booking/${id}/subscribe`,{templateId})}
export function acceptPolicy(version:string){return http.post<void>('/miniapp/property/operations/policy',{version})}
export function fetchSupportContext(){return http.get<{state:string,property?:{id:string,title:string}[]}>('/miniapp/property/operations/support')}
