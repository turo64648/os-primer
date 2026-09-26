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
  },
} satisfies Theme
