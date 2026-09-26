<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { load, save } from '../storage'

interface Question {
  q: string
  options: string[]
  answer: number
  explain: string
}

const props = defineProps<{ id: string; questions: Question[] }>()

const picked = ref<(number | null)[]>(props.questions.map(() => null))
const best = ref<number | null>(null)

const key = computed(() => `quiz:${props.id}`)
onMounted(() => {
  best.value = load<number | null>(key.value, null)
})

const answered = computed(() => picked.value.filter((p) => p !== null).length)
const score = computed(() => picked.value.filter((p, i) => p === props.questions[i].answer).length)
const finished = computed(() => answered.value === props.questions.length)

function pick(qi: number, oi: number) {
  if (picked.value[qi] !== null) return
  picked.value[qi] = oi
  if (finished.value && (best.value === null || score.value > best.value)) {
    best.value = score.value
    save(key.value, score.value)
  }
}

function retry() {
  picked.value = props.questions.map(() => null)
}
</script>

<template>
  <div class="widget quiz">
    <h4>Self-check quiz</h4>
    <p class="meta">
      Answer each question; the explanation appears once you choose.
      <template v-if="best !== null"> Your best score: {{ best }} / {{ questions.length }}.</template>
    </p>

    <ol>
      <li v-for="(q, qi) in questions" :key="qi">
        <p class="q" v-html="q.q" />
        <div class="options">
          <button
            v-for="(o, oi) in q.options"
            :key="oi"
            class="option"
            :class="{
              correct: picked[qi] !== null && oi === q.answer,
              wrong: picked[qi] === oi && oi !== q.answer,
            }"
            :disabled="picked[qi] !== null && picked[qi] !== oi && oi !== q.answer"
            @click="pick(qi, oi)"
            v-html="o"
          />
        </div>
        <p v-if="picked[qi] !== null" class="explain">
          <strong>{{ picked[qi] === q.answer ? 'Correct.' : 'Not quite.' }}</strong>
          {{ ' ' }}<span v-html="q.explain" />
        </p>
      </li>
    </ol>

    <div class="row footer">
      <span>Score: {{ score }} / {{ questions.length }} ({{ answered }} answered)</span>
      <button v-if="answered" @click="retry">Retry</button>
    </div>
  </div>
</template>

<style scoped>
.meta {
  font-size: 14px;
  color: var(--vp-c-text-2);
  margin: 0 0 8px;
}
ol {
  padding-left: 20px;
}
li + li {
  margin-top: 24px;
}
.q {
  font-weight: 600;
  margin: 0 0 8px;
}
.options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.option {
  text-align: left;
  font-size: 15px !important;
  line-height: 1.5;
  padding: 8px 12px !important;
}
.option.correct {
  border-color: var(--ok) !important;
  box-shadow: inset 3px 0 0 var(--ok);
}
.option.wrong {
  border-color: var(--bad) !important;
  box-shadow: inset 3px 0 0 var(--bad);
}
.explain {
  font-size: 15px;
  margin: 8px 0 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--vp-c-bg);
}
.footer {
  justify-content: space-between;
  font-weight: 600;
  font-size: 15px;
  margin-top: 20px;
}
</style>
