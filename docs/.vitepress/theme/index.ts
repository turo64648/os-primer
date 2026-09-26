import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './custom.css'

import AddressTranslator from './components/AddressTranslator.vue'
import ChapterList from './components/ChapterList.vue'
import ChapterStub from './components/ChapterStub.vue'
import Flashcards from './components/Flashcards.vue'
import MarkDone from './components/MarkDone.vue'
import Term from './components/Term.vue'
import GlossaryList from './components/GlossaryList.vue'
import VmOverviewDiagram from './components/diagrams/VmOverviewDiagram.vue'
import PageWalkDiagram from './components/diagrams/PageWalkDiagram.vue'
import AddressSpaceDiagram from './components/diagrams/AddressSpaceDiagram.vue'
import PageFaultDiagram from './components/diagrams/PageFaultDiagram.vue'
import SyscallPathDiagram from './components/diagrams/SyscallPathDiagram.vue'
import KernelEntryDiagram from './components/diagrams/KernelEntryDiagram.vue'
import KernelDesignsDiagram from './components/diagrams/KernelDesignsDiagram.vue'
import EpollDiagram from './components/diagrams/EpollDiagram.vue'
import IoUringDiagram from './components/diagrams/IoUringDiagram.vue'
import ZeroCopyDiagram from './components/diagrams/ZeroCopyDiagram.vue'
import PageKindsDiagram from './components/diagrams/PageKindsDiagram.vue'
import CowDiagram from './components/diagrams/CowDiagram.vue'
import ReclaimWatermarksDiagram from './components/diagrams/ReclaimWatermarksDiagram.vue'
import ProcessStatesDiagram from './components/diagrams/ProcessStatesDiagram.vue'
import ForkExecWaitDiagram from './components/diagrams/ForkExecWaitDiagram.vue'
import ThreadsVsProcessesDiagram from './components/diagrams/ThreadsVsProcessesDiagram.vue'
import ContextSwitchDiagram from './components/diagrams/ContextSwitchDiagram.vue'
import RunQueuesDiagram from './components/diagrams/RunQueuesDiagram.vue'
import CpuThrottlingDiagram from './components/diagrams/CpuThrottlingDiagram.vue'
import SchedulerSimulator from './components/SchedulerSimulator.vue'
import AllocatorLayersDiagram from './components/diagrams/AllocatorLayersDiagram.vue'
import HeapChunksDiagram from './components/diagrams/HeapChunksDiagram.vue'
import RssPinnedDiagram from './components/diagrams/RssPinnedDiagram.vue'
import FileLinksDiagram from './components/diagrams/FileLinksDiagram.vue'
import FdTableDiagram from './components/diagrams/FdTableDiagram.vue'
import DurabilityLayersDiagram from './components/diagrams/DurabilityLayersDiagram.vue'
import ElfViewsDiagram from './components/diagrams/ElfViewsDiagram.vue'
import PltGotDiagram from './components/diagrams/PltGotDiagram.vue'
import ProgramStartupDiagram from './components/diagrams/ProgramStartupDiagram.vue'
import DeadlockDiagram from './components/diagrams/DeadlockDiagram.vue'
import PriorityInversionDiagram from './components/diagrams/PriorityInversionDiagram.vue'
import RaceStepper from './components/RaceStepper.vue'
import CacheHierarchyDiagram from './components/diagrams/CacheHierarchyDiagram.vue'
import FalseSharingDiagram from './components/diagrams/FalseSharingDiagram.vue'
import NumaDiagram from './components/diagrams/NumaDiagram.vue'
import StorageStackDiagram from './components/diagrams/StorageStackDiagram.vue'
import FtlDiagram from './components/diagrams/FtlDiagram.vue'
import RaidDiagram from './components/diagrams/RaidDiagram.vue'
import WallVsMonotonicDiagram from './components/diagrams/WallVsMonotonicDiagram.vue'
import TickModesDiagram from './components/diagrams/TickModesDiagram.vue'
import TimerWheelDiagram from './components/diagrams/TimerWheelDiagram.vue'
import VmVsContainerDiagram from './components/diagrams/VmVsContainerDiagram.vue'
import NestedPagingDiagram from './components/diagrams/NestedPagingDiagram.vue'
import ContainerAnatomyDiagram from './components/diagrams/ContainerAnatomyDiagram.vue'
import StoreBufferDiagram from './components/diagrams/StoreBufferDiagram.vue'
import RcuDiagram from './components/diagrams/RcuDiagram.vue'
import PacketPathDiagram from './components/diagrams/PacketPathDiagram.vue'
import TcpCloseDiagram from './components/diagrams/TcpCloseDiagram.vue'
import AcceptQueueDiagram from './components/diagrams/AcceptQueueDiagram.vue'
import SyscallChecksDiagram from './components/diagrams/SyscallChecksDiagram.vue'
import StackSmashDiagram from './components/diagrams/StackSmashDiagram.vue'
import SpeculationLeakDiagram from './components/diagrams/SpeculationLeakDiagram.vue'
import IpcCopiesDiagram from './components/diagrams/IpcCopiesDiagram.vue'
import FdPassingDiagram from './components/diagrams/FdPassingDiagram.vue'
import OnOffCpuDiagram from './components/diagrams/OnOffCpuDiagram.vue'
import FlameGraphDiagram from './components/diagrams/FlameGraphDiagram.vue'
import QueueingDiagram from './components/diagrams/QueueingDiagram.vue'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('AddressTranslator', AddressTranslator)
    app.component('ChapterList', ChapterList)
    app.component('ChapterStub', ChapterStub)
    app.component('Flashcards', Flashcards)
    app.component('MarkDone', MarkDone)
    app.component('Term', Term)
    app.component('GlossaryList', GlossaryList)
    app.component('VmOverviewDiagram', VmOverviewDiagram)
    app.component('PageWalkDiagram', PageWalkDiagram)
    app.component('AddressSpaceDiagram', AddressSpaceDiagram)
    app.component('PageFaultDiagram', PageFaultDiagram)
    app.component('SyscallPathDiagram', SyscallPathDiagram)
    app.component('KernelEntryDiagram', KernelEntryDiagram)
    app.component('KernelDesignsDiagram', KernelDesignsDiagram)
    app.component('EpollDiagram', EpollDiagram)
    app.component('IoUringDiagram', IoUringDiagram)
    app.component('ZeroCopyDiagram', ZeroCopyDiagram)
    app.component('PageKindsDiagram', PageKindsDiagram)
    app.component('CowDiagram', CowDiagram)
    app.component('ReclaimWatermarksDiagram', ReclaimWatermarksDiagram)
    app.component('ProcessStatesDiagram', ProcessStatesDiagram)
    app.component('ForkExecWaitDiagram', ForkExecWaitDiagram)
    app.component('ThreadsVsProcessesDiagram', ThreadsVsProcessesDiagram)
    app.component('ContextSwitchDiagram', ContextSwitchDiagram)
    app.component('RunQueuesDiagram', RunQueuesDiagram)
    app.component('CpuThrottlingDiagram', CpuThrottlingDiagram)
    app.component('SchedulerSimulator', SchedulerSimulator)
    app.component('AllocatorLayersDiagram', AllocatorLayersDiagram)
    app.component('HeapChunksDiagram', HeapChunksDiagram)
    app.component('RssPinnedDiagram', RssPinnedDiagram)
    app.component('FileLinksDiagram', FileLinksDiagram)
    app.component('FdTableDiagram', FdTableDiagram)
    app.component('DurabilityLayersDiagram', DurabilityLayersDiagram)
    app.component('ElfViewsDiagram', ElfViewsDiagram)
    app.component('PltGotDiagram', PltGotDiagram)
    app.component('ProgramStartupDiagram', ProgramStartupDiagram)
    app.component('DeadlockDiagram', DeadlockDiagram)
    app.component('PriorityInversionDiagram', PriorityInversionDiagram)
    app.component('RaceStepper', RaceStepper)
    app.component('CacheHierarchyDiagram', CacheHierarchyDiagram)
    app.component('FalseSharingDiagram', FalseSharingDiagram)
    app.component('NumaDiagram', NumaDiagram)
    app.component('StorageStackDiagram', StorageStackDiagram)
    app.component('FtlDiagram', FtlDiagram)
    app.component('RaidDiagram', RaidDiagram)
    app.component('WallVsMonotonicDiagram', WallVsMonotonicDiagram)
    app.component('TickModesDiagram', TickModesDiagram)
    app.component('TimerWheelDiagram', TimerWheelDiagram)
    app.component('VmVsContainerDiagram', VmVsContainerDiagram)
    app.component('NestedPagingDiagram', NestedPagingDiagram)
    app.component('ContainerAnatomyDiagram', ContainerAnatomyDiagram)
    app.component('StoreBufferDiagram', StoreBufferDiagram)
    app.component('RcuDiagram', RcuDiagram)
    app.component('PacketPathDiagram', PacketPathDiagram)
    app.component('TcpCloseDiagram', TcpCloseDiagram)
    app.component('AcceptQueueDiagram', AcceptQueueDiagram)
    app.component('SyscallChecksDiagram', SyscallChecksDiagram)
    app.component('StackSmashDiagram', StackSmashDiagram)
    app.component('SpeculationLeakDiagram', SpeculationLeakDiagram)
    app.component('IpcCopiesDiagram', IpcCopiesDiagram)
    app.component('FdPassingDiagram', FdPassingDiagram)
    app.component('OnOffCpuDiagram', OnOffCpuDiagram)
    app.component('FlameGraphDiagram', FlameGraphDiagram)
    app.component('QueueingDiagram', QueueingDiagram)
  },
} satisfies Theme
