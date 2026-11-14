
const generalController = {

    mostrarInicio: (req, res) => {
        res.render('general/inicio', {
            titulo: 'TalentoHub',
            mensaje: 'Bienvenido a TalentoHub'
        });
    }

};

module.exports = generalController;
