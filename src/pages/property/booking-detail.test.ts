import { flushPromises,mount } from '@vue/test-utils'
import { computed,ref,reactive } from 'vue'
import { beforeEach,afterEach,expect,it,vi } from 'vitest'
import Page from './booking-detail.vue'
const mocks=vi.hoisted(()=>({detail:vi.fn(),settings:vi.fn(),action:vi.fn(),subscribe:vi.fn(),login:vi.fn(),signedIn:true,hooks:{} as Record<string,(q?:Record<string,string>)=>void>}))
vi.mock('@/api/operations',()=>({fetchBookingDetail:mocks.detail,fetchOpsSettings:mocks.settings,actOnBooking:mocks.action,subscribeBooking:mocks.subscribe,bookingLabels:{1:'待确认',2:'已确认',4:'已取消'}}))
let token: {validToken:string,updateNowTime:()=>{hasLogin:boolean}}
vi.mock('@/store/token',()=>({useTokenStore:()=>token}))
vi.mock('@/utils/toLoginPage',()=>({toLoginPage:mocks.login}))
let wrapper:ReturnType<typeof mount>|undefined
const detail={id:'200',propertyId:'100',userId:'1',status:2,statusLabel:'已确认',canManage:false,isGuest:true,bookingTime:'2026-12-01 10:00:00',contactName:'访客',contactPhone:'13800000000',property:[{id:'100',title:'测试房源'}],reception:{meetingPoint:'东门'},logs:[{id:'3',toStatus:2,reason:'已确认',createTime:'2026-11-17 12:00:00'}]}
beforeEach(()=>{token=reactive({validToken:'first',updateNowTime:()=>({hasLogin:mocks.signedIn})});mocks.detail.mockReset().mockResolvedValue(detail);mocks.settings.mockReset().mockResolvedValue({subscriptionEnabled:false});mocks.action.mockReset().mockResolvedValue(undefined);mocks.subscribe.mockReset().mockResolvedValue(undefined);mocks.login.mockReset();mocks.signedIn=true;mocks.hooks={};vi.stubGlobal('ref',ref);vi.stubGlobal('computed',computed);vi.stubGlobal('definePage',vi.fn());for(const name of ['onLoad','onShow','onHide','onUnload'])vi.stubGlobal(name,(cb:(q?:Record<string,string>)=>void)=>{mocks.hooks[name]=cb})})
afterEach(()=>{wrapper?.unmount();wrapper=undefined;vi.unstubAllGlobals()})
async function open(){wrapper=mount(Page,{global:{stubs:{picker:{template:'<div class="picker"><slot/></div>'}}}});mocks.hooks.onLoad({id:'200'});mocks.hooks.onShow();await flushPromises()}
function button(text:string){return wrapper!.findAll('button').find(b=>b.text()===text)!}
it('shows the real appointment, meeting point and disabled subscription state',async()=>{await open();expect(mocks.detail).toHaveBeenCalledWith('200');expect(wrapper!.text()).toContain('东门');expect(wrapper!.text()).toContain('微信提醒暂未启用');expect(button('确认预约')).toBeUndefined();expect(mocks.subscribe).not.toHaveBeenCalled()})
it('requires a reason and preserves input on a failed cancellation',async()=>{await open();await button('取消预约').trigger('tap');await button('确认提交').trigger('tap');expect(mocks.action).not.toHaveBeenCalled();await wrapper!.get('textarea').setValue('临时有事');mocks.action.mockRejectedValueOnce(new Error('请重试'));await button('确认提交').trigger('tap');await flushPromises();expect(mocks.action).toHaveBeenCalledWith('200',{action:'CANCEL',reason:'临时有事',bookingTime:undefined});expect((wrapper!.get('textarea').element as HTMLTextAreaElement).value).toBe('临时有事');expect(wrapper!.text()).toContain('请重试')})
it('submits rescheduling in the server time format',async()=>{await open();await button('申请改期').trigger('tap');await wrapper!.get('textarea').setValue('调整时间');const pickers=wrapper!.findAll('.picker');await pickers[0].trigger('change',{detail:{value:'2026-12-02'}});await pickers[1].trigger('change',{detail:{value:'11:20'}});await button('确认提交').trigger('tap');await flushPromises();expect(mocks.action).toHaveBeenCalledWith('200',{action:'RESCHEDULE',reason:'调整时间',bookingTime:'2026-12-02 11:20:00'})})
it('requires login before loading private appointment data',async()=>{mocks.signedIn=false;await open();expect(mocks.login).toHaveBeenCalledOnce();expect(mocks.detail).not.toHaveBeenCalled()})
it('does not apply a response after leaving the page',async()=>{let resolve!:(v:typeof detail)=>void;mocks.detail.mockReturnValue(new Promise(r=>{resolve=r}));wrapper=mount(Page);mocks.hooks.onLoad({id:'200'});mocks.hooks.onShow();mocks.hooks.onUnload();resolve(detail);await flushPromises();expect(wrapper.text()).not.toContain('测试房源')})

it('clears private data on hide and discards an old account response', async()=>{
 await open(); mocks.hooks.onHide(); await flushPromises(); expect(wrapper!.text()).not.toContain('13800000000')
 let resolve!:(v:typeof detail)=>void
 mocks.detail.mockReturnValueOnce(new Promise(r=>{resolve=r}));mocks.hooks.onShow()
 mocks.detail.mockResolvedValueOnce({...detail,contactName:'新账号',contactPhone:'new'});token.validToken='second';await flushPromises()
 resolve(detail);await flushPromises();expect(wrapper!.text()).toContain('新账号');expect(wrapper!.text()).not.toContain('13800000000')
})
