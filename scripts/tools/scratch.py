import re
import sys

def modify_file():
    path = 'apps/miniapp/app/(mechanic)/mechanic/orders/[id]/page.tsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Remove ExtraWorkModal and add CompleteWorkModal
    content = re.sub(r'// ─── ExtraWorkModal ──.*?// ─── AddPartModal ──', '''// ─── CompleteWorkModal ────────────────────────────────────────────────────────

function CompleteWorkModal({
  open,
  onClose,
  work,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  work: WorkItem | null;
  onComplete: (minutes: number) => void;
}) {
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('0');
  
  // Default to norm_minutes if available when opening
  useEffect(() => {
    if (open && work) {
      const norm = work.work_catalog?.norm_minutes || 0;
      if (norm > 0) {
        setHours(Math.floor(norm / 60).toString());
        setMinutes((norm % 60).toString());
      } else {
        setHours('0');
        setMinutes('0');
      }
    }
  }, [open, work]);

  if (!work) return null;
  const workName = work.work_catalog?.name || work.custom_work_name || 'Без названия';

  const handleSave = () => {
    const h = parseInt(hours || '0', 10);
    const m = parseInt(minutes || '0', 10);
    onComplete(h * 60 + m);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Завершение работы">
      <div className="space-y-4">
        <p className="text-sm text-slate-500 text-center mb-4">{workName}</p>

        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
          <label className="block text-[10px] font-black text-orange-800 uppercase tracking-widest mb-3 text-center">
            Сколько времени вы потратили?
          </label>
          <div className="flex items-center justify-center gap-4">
            <div className="flex flex-col items-center">
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                min="0"
                className="w-20 text-center bg-white border-2 border-orange-200 rounded-xl py-3 text-2xl font-black focus:outline-none focus:border-orange-500"
              />
              <span className="text-xs font-bold text-orange-600 uppercase mt-2">Часов</span>
            </div>
            <span className="text-2xl font-black text-orange-300 mb-6">:</span>
            <div className="flex flex-col items-center">
              <input
                type="number"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                min="0"
                max="59"
                className="w-20 text-center bg-white border-2 border-orange-200 rounded-xl py-3 text-2xl font-black focus:outline-none focus:border-orange-500"
              />
              <span className="text-xs font-bold text-orange-600 uppercase mt-2">Минут</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-center mb-2">
          <button onClick={() => { setHours('0'); setMinutes('30'); }} className="bg-slate-100 text-slate-600 text-xs font-black px-4 py-2 rounded-lg active:bg-slate-200">+ 30 мин</button>
          <button onClick={() => { setHours('1'); setMinutes('0'); }} className="bg-slate-100 text-slate-600 text-xs font-black px-4 py-2 rounded-lg active:bg-slate-200">+ 1 час</button>
          {work.work_catalog?.norm_minutes ? (
             <button onClick={() => { setHours(Math.floor(work.work_catalog!.norm_minutes / 60).toString()); setMinutes((work.work_catalog!.norm_minutes % 60).toString()); }} className="bg-slate-100 text-slate-600 text-xs font-black px-4 py-2 rounded-lg active:bg-slate-200">По норме</button>
          ) : null}
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-green-600 text-white rounded-xl py-4 text-sm font-black uppercase tracking-widest active:scale-95 transition-transform"
        >
          ✓ Сохранить и завершить
        </button>
      </div>
    </BottomSheet>
  );
}

// ─── AddPartModal ──''', content, flags=re.DOTALL)

    # 2. Update WorkCard signature and internals
    content = re.sub(
        r'function WorkCard\(\{.*?return \(\n    <div\n' , 
        '''function WorkCard({ work, onCompleteClick }: { work: WorkItem; onCompleteClick: () => void }) {    
  const workName = work.work_catalog?.name || work.custom_work_name || 'Без названия';
  const normMins = work.work_catalog?.norm_minutes ?? 0;
  const isDone = work.status === 'completed';

  return (
    <div\n''', content, flags=re.DOTALL)

    # Update WorkCard status chip
    content = re.sub(
        r'isRunning\n.*?\"bg-slate-100 text-slate-400\",\n          \)\}\n        >\n          \{isRunning \? \'В работе\' : work\.status === \'completed\' \? \'Готово\' : \'В очереди\'\}\n        <\/span>',
        '''isDone
              ? 'bg-green-100 text-green-700'
              : 'bg-slate-100 text-slate-400',
          )}
        >
          {isDone ? '✓ Выполнено' : 'В очереди'}
        </span>''', content, flags=re.DOTALL)

    # Replace WorkCard buttons
    content = re.sub(
        r'\{canWork && \(\n.*?<\/div>\n      \)\}\n\n      \{isPendingApproval.*?\n      \)\}\n\n      \{work\.status === \'completed\'.*?<\/div>\n      \)\}', 
        '''{!isDone && (
        <div className="mt-3">
          <button
            onClick={onCompleteClick}
            className="w-full bg-green-600 text-white rounded-lg py-3 text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
          >
            ✓ Указать время и завершить
          </button>
        </div>
      )}
      
      {isDone && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-bold uppercase">Потрачено времени</span>
            <span className="font-black text-slate-900">{work.actual_minutes || 0} мин</span>
          </div>
        </div>
      )}''', content, flags=re.DOTALL)

    # 3. Modify Page component state and hooks
    content = re.sub(r'const \[showExtraWork, setShowExtraWork\] = useState\(false\);\n  const \[acceptError, setAcceptError\] = useState\(\'\'\);', 
        '''const [workToComplete, setWorkToComplete] = useState<WorkItem | null>(null);\n  const [acceptError, setAcceptError] = useState('');''', content)

    content = re.sub(r'const startMutation = useMutation\(\{.*?\}\);\n\n  const stopMutation = useMutation\(\{.*?\}\);', 
        '''const completeWorkMutation = useMutation({
    mutationFn: async ({ workId, actual_minutes }: { workId: string; actual_minutes: number }) => {
      const res = await fetch(`/api/mechanic/orders/${id}/work/${workId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual_minutes }),
      });
      if (!res.ok) throw new Error('Ошибка завершения');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-detail', id] });
      setWorkToComplete(null);
    },
  });''', content, flags=re.DOTALL)

    # 4. Remove allWorksComplete and canComplete complex logic
    content = re.sub(r'const activeWorks = order\.works.*?const canComplete = .*?;', 
        '''const canComplete = order.works.length > 0 && order.works.every((w) => w.status === 'completed') && order.status === 'in_progress';''', content, flags=re.DOTALL)

    # 5. Remove pending extra work banners
    content = re.sub(r'\{hasPendingExtraWork && inProgress && \(\n        <div className=\"fixed bottom-0 left-0 right-0 z-\[55\] bg-amber-50.*?\n      \)\}', '', content, flags=re.DOTALL)

    # Remove extra work button
    content = re.sub(r'\{inProgress && \(\n                <button\n                  onClick=\{\(\) => setShowExtraWork\(true\)\}\n                  className=\"bg-amber-100 text-amber-700 px-3 py-1\.5 rounded-lg text-\[10px\] font-black uppercase tracking-widest active:scale-95 transition-transform\"\n                >\n                  ⚡ Доп\. работа\n                <\/button>\n              \)\}', '', content, flags=re.DOTALL)

    # Update WorkCard rendering
    content = re.sub(r'\{order\.works\.map\(\(work\) => \(\n            <WorkCard\n              key=\{work\.id\}\n              work=\{work\}\n              now=\{now\}\n              onStart=\{\(\) => startMutation\.mutate\(work\.id\)\}\n              onStop=\{\(status\) => stopMutation\.mutate\(\{ workId: work\.id, status \}\)\}\n              isStarting=\{startMutation\.isPending\}\n              isStopping=\{stopMutation\.isPending\}\n            />\n          \)\)\}', 
        '''{order.works.map((work) => (
            <WorkCard
              key={work.id}
              work={work}
              onCompleteClick={() => setWorkToComplete(work)}
            />
          ))}''', content, flags=re.DOTALL)

    # Replace ExtraWorkModal tag with CompleteWorkModal tag
    content = re.sub(r'<ExtraWorkModal open=\{showExtraWork\} onClose=\{\(\) => setShowExtraWork\(false\)\} orderId=\{id\} />', 
        '''<CompleteWorkModal 
        open={!!workToComplete} 
        work={workToComplete} 
        onClose={() => setWorkToComplete(null)}
        onComplete={(minutes) => completeWorkMutation.mutate({ workId: workToComplete!.id, actual_minutes: minutes })}
      />''', content)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    modify_file()
