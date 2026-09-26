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
  },
} satisfies Theme
