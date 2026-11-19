// Booking Result: последний узел ветки — его JSON получает модель.
const src = ['Finish', 'Decide', 'Plan'].find((name) => $(name).isExecuted);
return [{ json: $(src).first().json.result }];
