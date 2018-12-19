/*
variables
*/
var model;
var canvas;
var classNames = [];
var canvas;
var coords = [];
var mousePressed = false;
var mode;
var quizNames = [];
var current_question = '';
var isGameStarted = false;
var isGameEnded = false;
var isChanging = false;
var score = 0;
/*
prepare the drawing canvas 
*/
$(function() {
    canvas = window._canvas = new fabric.Canvas('canvas');
    canvas.backgroundColor = '#ffffff';
    canvas.isDrawingMode = 0;
    canvas.freeDrawingBrush.color = "black";
    canvas.freeDrawingBrush.width = 10;
    canvas.renderAll();
    //setup listeners 
    canvas.on('mouse:up', function(e) {
        getFrame();
        mousePressed = false
    });
    canvas.on('mouse:down', function(e) {
        mousePressed = true
    });
    canvas.on('mouse:move', function(e) {
        recordCoor(e)
    });
})

/*
set the table of the predictions 
*/
function setTable(top5, probs) {
    //loop over the predictions 
    for (var i = 0; i < top5.length; i++) {
        let sym = document.getElementById('sym' + (i + 1))
        let prob = document.getElementById('prob' + (i + 1))
        sym.innerHTML = top5[i]
        prob.innerHTML = Math.round(probs[i] * 100)
    }
    //create the pie 
    createPie(".pieID.legend", ".pieID.pie");

}

/*
record the current drawing coordinates
*/
function recordCoor(event) {
    var pointer = canvas.getPointer(event.e);
    var posX = pointer.x;
    var posY = pointer.y;

    if (posX >= 0 && posY >= 0 && mousePressed) {
        coords.push(pointer)
    }
}

/*
get the best bounding box by trimming around the drawing
*/
function getMinBox() {
    //get coordinates 
    var coorX = coords.map(function(p) {
        return p.x
    });
    var coorY = coords.map(function(p) {
        return p.y
    });

    //find top left and bottom right corners 
    var min_coords = {
        x: Math.min.apply(null, coorX),
        y: Math.min.apply(null, coorY)
    }
    var max_coords = {
        x: Math.max.apply(null, coorX),
        y: Math.max.apply(null, coorY)
    }

    //return as strucut 
    return {
        min: min_coords,
        max: max_coords
    }
}

/*
get the current image data 
*/
function getImageData() {
        //get the minimum bounding box around the drawing 
        const mbb = getMinBox()

        //get image data according to dpi 
        const dpi = window.devicePixelRatio
        const imgData = canvas.contextContainer.getImageData(mbb.min.x * dpi, mbb.min.y * dpi,
                                                      (mbb.max.x - mbb.min.x) * dpi, (mbb.max.y - mbb.min.y) * dpi);
        return imgData
    }

/*
get the prediction 
*/
function getFrame() {
    //make sure we have at least two recorded coordinates 
    if (coords.length >= 2) {

        //get the image data from the canvas 
        const imgData = getImageData()

        //get the prediction 
        const pred = model.predict(preprocess(imgData)).dataSync()

        //find the top 5 predictions 
        const indices = findIndicesOfMax(pred, 5)
        const probs = findTopValues(pred, 5)
        const names = getClassNames(indices)

        //set the table 
        setTable(names, probs)

        if(names[0] == current_question){
            document.getElementById('status').innerHTML = '아하! 이건 <b>'+ names[0] + '</b> 입니다!' //top1
            if(quizNames.length && !isChanging){ // 퀴즈를 모두 내지 않았고, 문제를 바꾸고 있지 않을때
                isChanging = true;
                score += 1;
                console.log("you scored!")
                setTimeout(function(){
                    changeQuestion();
                    isChanging = false;
                }, 3000);
            }
            else if(!quizNames.length && !isGameEnded){ // 문제를 모두 냈을 때
                isGameEnded = true;
                score += 1;
                setTimeout(function(){
                    gameIsFinished(); 
                }, 3000);
            }
           }
        else if(!isChanging){
            document.getElementById('status').innerHTML = '음.. 이건 <b>'+ names[0] + '</b> 인가요?' //top1
        }

    }

}

/*
get the the class names 
*/ 
function getClassNames(indices) {
    var outp = []
    for (var i = 0; i < indices.length; i++)
        outp[i] = classNames[indices[i]]
    return outp
}

/*
load the class names 
*/
async function loadDict() {
    if (mode == 'ar')
        loc = 'model/class_names_ar.txt'
    else
        loc = 'model/class_names.txt'
    
    await $.ajax({
        url: loc,
        dataType: 'text',
    }).done(success);
}

/*
load the class names
*/
function success(data) {
    const lst = data.split(/\n/)
    for (var i = 0; i < lst.length - 1; i++) {
        let symbol = lst[i]
        let classKoNames = {'fireplace': '벽난로', 'postcard': '엽서', 'snowman': '눈사람', 'sweater': '스웨터', 'cake': '케이크', 'penguin': '펭귄', 'sock': '양말', 'spider': '거미', 'mug': '머그컵',};
        classNames[i] = classKoNames[symbol];
    }
}

/*
get indices of the top probs
*/
function findIndicesOfMax(inp, count) {
    var outp = [];
    for (var i = 0; i < inp.length; i++) {
        outp.push(i); // add index to output array
        if (outp.length > count) {
            outp.sort(function(a, b) {
                return inp[b] - inp[a];
            }); // descending sort the output array // remove the last index (index of smallest element in output array)
            outp.pop();
        }
    }
    return outp;
}

/*
find the top  predictions
*/
function findTopValues(inp, count) {
    var outp = [];
    let indices = findIndicesOfMax(inp, count)
    // show 5 greatest scores
    for (var i = 0; i < indices.length; i++)
        outp[i] = inp[indices[i]]
    return outp
}

/*
preprocess the data
*/
function preprocess(imgData) {
    return tf.tidy(() => {
        //convert to a tensor 
        let tensor = tf.fromPixels(imgData, numChannels = 1)
        
        //resize 
        const resized = tf.image.resizeBilinear(tensor, [28, 28]).toFloat()
        
        //normalize 
        const offset = tf.scalar(255.0);
        const normalized = tf.scalar(1.0).sub(resized.div(offset));

        //We add a dimension to get a batch shape 
        const batched = normalized.expandDims(0)
        return batched
    })
}

/*
load the model
*/
async function start(cur_mode) {
    //arabic or english
    mode = cur_mode
    
    //load the model 
    model = await tf.loadModel('model/model.json')
    
    //warm up 
    model.predict(tf.zeros([1, 28, 28, 1]))
    
    //allow drawing on the canvas 
    allowDrawing()
    
    //load the class names
    await loadDict()
    changeQuestion();
}   

/*
allow drawing on canvas
*/
function allowDrawing() {
    canvas.isDrawingMode = 1;
    if (mode == 'en'){
        document.getElementById('status').innerHTML = '시작!';
    }
    else
        document.getElementById('status').innerHTML = 'تم التحميل';
    $('button').prop('disabled', false);
    var slider = document.getElementById('myRange');
    slider.oninput = function() {
        canvas.freeDrawingBrush.width = this.value;
    };

}

/*
clear the canvs 
*/
function erase() {
    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    coords = [];
}

function changeQuestion(){
    console.log("changing question...");
    if(isGameStarted == false){
        for(let i=0; i<classNames.length; i++){
            quizNames[i] = classNames[i];
        }
        isGameStarted = true;
    }
    const random_idx = Math.floor(Math.random() * quizNames.length);
    current_question = quizNames.splice(random_idx, 1);
    document.getElementById('quiz').innerHTML = current_question;
}

function gameIsFinished(){
    console.log("game over");
    document.getElementById('quiz').innerHTML = "게임 종료";
    document.getElementById('status').innerHTML = "정답: "+score+"/9";
    alert("게임 종료\n정답: "+score+"/9");

}