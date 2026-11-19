// Sales Result: последний узел ветки — его JSON получает модель.
const src = ['Lead Result', 'Products', 'Call Link', 'Rank Facts', 'Upsert Lead'].find((name) => $(name).isExecuted);
return [{ json: $(src).first().json.result }];
